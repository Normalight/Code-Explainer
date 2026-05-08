package com.codeexplainer.service;

import org.treesitter.TSNode;
import org.treesitter.TSParser;
import org.treesitter.TSTree;
import org.treesitter.TSLanguage;
import org.treesitter.TreeSitterPython;
import org.treesitter.TreeSitterJava;
import org.treesitter.TreeSitterJavascript;
import org.treesitter.TreeSitterTypescript;
import org.treesitter.TreeSitterTsx;
import org.treesitter.TreeSitterGo;
import org.treesitter.TreeSitterRust;
import org.treesitter.TreeSitterC;
import org.treesitter.TreeSitterCpp;
import org.treesitter.TreeSitterCss;
import org.treesitter.TreeSitterBash;
import org.treesitter.TreeSitterJson;
import org.treesitter.TreeSitterRuby;
import org.treesitter.TreeSitterHtml;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class TreeSitterAstParser {

    private static final Map<String, TSLanguage> LANGUAGE_MAP = buildLanguageMap();

    private static volatile boolean nativeAvailable = true;

    private static Map<String, TSLanguage> buildLanguageMap() {
        Map<String, TSLanguage> map = new LinkedHashMap<>();
        map.put("Python", (TSLanguage) new TreeSitterPython());
        map.put("Java", (TSLanguage) new TreeSitterJava());
        map.put("JavaScript", (TSLanguage) new TreeSitterJavascript());
        map.put("TypeScript", (TSLanguage) new TreeSitterTypescript());
        map.put("TSX", (TSLanguage) new TreeSitterTsx());
        map.put("Go", (TSLanguage) new TreeSitterGo());
        map.put("Rust", (TSLanguage) new TreeSitterRust());
        map.put("C", (TSLanguage) new TreeSitterC());
        map.put("C++", (TSLanguage) new TreeSitterCpp());
        map.put("CSS", (TSLanguage) new TreeSitterCss());
        map.put("Bash", (TSLanguage) new TreeSitterBash());
        map.put("JSON", (TSLanguage) new TreeSitterJson());
        map.put("Ruby", (TSLanguage) new TreeSitterRuby());
        map.put("HTML", (TSLanguage) new TreeSitterHtml());
        return map;
    }

    public static List<AstNode> parse(String code, String language) {
        if (code == null || code.isBlank()) return List.of();
        if (!nativeAvailable) return SimpleAstParser.parse(code, language);

        try {
            return parseWithTreeSitter(code, language);
        } catch (UnsatisfiedLinkError | Exception e) {
            nativeAvailable = false;
            return SimpleAstParser.parse(code, language);
        }
    }

    private static List<AstNode> parseWithTreeSitter(String code, String language) {
        TSLanguage tsLang = LANGUAGE_MAP.get(normalizeLanguage(language));
        if (tsLang == null) return SimpleAstParser.parse(code, language);

        TSParser parser = new TSParser();
        parser.setLanguage(tsLang);

        byte[] sourceBytes = code.getBytes(StandardCharsets.UTF_8);
        TSTree tree = parser.parseString(null, code);
        TSNode root = tree.getRootNode();

        List<AstNode> nodes = collectTreeNodes(root, sourceBytes, 0);
        tree.close();
        return nodes;
    }

    private static List<AstNode> collectTreeNodes(TSNode node, byte[] source, int depth) {
        if (depth > 30) return List.of();

        List<AstNode> result = new ArrayList<>();
        for (int i = 0; i < node.getChildCount(); i++) {
            TSNode child = node.getChild(i);
            String type = child.getType();

            if (isInterestingType(type)) {
                String name = findName(child, source);
                if (name != null) {
                    int startLine = child.getStartPoint().getRow() + 1;
                    int endLine = child.getEndPoint().getRow() + 1;
                    String normalized = normalizeType(type, child);
                    List<AstNode> children = collectTreeNodes(child, source, depth + 1);
                    result.add(new AstNode(normalized, name, startLine, endLine, children));
                }
            } else {
                result.addAll(collectTreeNodes(child, source, depth + 1));
            }
        }
        return result;
    }

    private static boolean isInterestingType(String type) {
        return switch (type) {
            case "function_definition", "function_declaration", "generator_function_declaration",
                 "method_definition", "method_declaration", "constructor_definition",
                 "arrow_function", "function_item",
                 "class_definition", "class_declaration",
                 "interface_declaration",
                 "struct_item", "enum_declaration",
                 "impl_item", "trait",
                 "type_declaration",
                 "lexical_declaration", "variable_declaration" -> true;
            default -> false;
        };
    }

    private static String normalizeType(String type) {
        return switch (type) {
            case "function_definition", "function_declaration", "generator_function_declaration",
                 "arrow_function", "function_item" -> "function";
            case "method_definition", "method_declaration", "constructor_definition" -> "method";
            case "class_definition", "class_declaration" -> "class";
            case "interface_declaration" -> "interface";
            case "struct_item" -> "struct";
            case "enum_declaration" -> "enum";
            case "impl_item" -> "impl";
            case "trait" -> "trait";
            case "type_declaration" -> "type"; // refined in overload below
            case "lexical_declaration", "variable_declaration" -> "variable";
            default -> type;
        };
    }

    private static String normalizeType(String type, TSNode node) {
        if (type.equals("type_declaration")) {
            if (hasDescendantType(node, "struct_type")) return "struct";
            if (hasDescendantType(node, "interface_type")) return "interface";
            return "type";
        }
        return normalizeType(type);
    }

    private static boolean hasDescendantType(TSNode node, String targetType) {
        for (int i = 0; i < node.getChildCount(); i++) {
            TSNode child = node.getChild(i);
            if (child.getType().equals(targetType)) return true;
            if (hasDescendantType(child, targetType)) return true;
        }
        return false;
    }

    private static String findName(TSNode node, byte[] source) {
        String type = node.getType();

        // Functions/methods: find identifier child
        if (type.contains("function") || type.contains("method") || type.equals("constructor_definition")) {
            String name = findChildText(node, source, "identifier", "property_identifier", "type_identifier");
            if (name != null) return name;
            // For Go: function_item wraps identifier directly
            return findNamedChildText(node, source);
        }

        // Classes, structs, enums, interfaces, traits, impls
        if (type.equals("class_definition") || type.equals("class_declaration")
                || type.equals("interface_declaration") || type.equals("struct_item")
                || type.equals("enum_declaration") || type.equals("trait")
                || type.equals("impl_item")) {
            return findChildText(node, source, "identifier", "type_identifier");
        }

        // Go type_declaration: type_declaration > type_spec > type_identifier
        if (type.equals("type_declaration")) {
            return findChildText(node, source, "type_identifier");
        }

        // Lexical/variable declarations: get variable declarator name
        if (type.equals("lexical_declaration") || type.equals("variable_declaration")) {
            // Find variable_declarator child, then its identifier
            for (int i = 0; i < node.getChildCount(); i++) {
                TSNode child = node.getChild(i);
                if (child.getType().equals("variable_declarator") || child.getType().equals("declarator")) {
                    String name = findChildText(child, source, "identifier");
                    if (name != null) return name;
                }
            }
            return findChildText(node, source, "identifier");
        }

        return null;
    }

    private static String findChildText(TSNode node, byte[] source, String... targetTypes) {
        for (int i = 0; i < node.getChildCount(); i++) {
            TSNode child = node.getChild(i);
            for (String targetType : targetTypes) {
                if (child.getType().equals(targetType)) {
                    return extractText(child, source);
                }
            }
            // Search one level deeper
            for (int j = 0; j < child.getChildCount(); j++) {
                TSNode grandchild = child.getChild(j);
                for (String targetType : targetTypes) {
                    if (grandchild.getType().equals(targetType)) {
                        return extractText(grandchild, source);
                    }
                }
            }
        }
        return null;
    }

    private static String findNamedChildText(TSNode node, byte[] source) {
        for (int i = 0; i < node.getNamedChildCount(); i++) {
            TSNode child = node.getNamedChild(i);
            if (child.getType().equals("identifier") || child.getType().equals("property_identifier")) {
                return extractText(child, source);
            }
        }
        return null;
    }

    private static String extractText(TSNode node, byte[] source) {
        int start = (int) node.getStartByte();
        int end = (int) node.getEndByte();
        if (start >= end || end > source.length) return null;
        return new String(source, start, end - start, StandardCharsets.UTF_8);
    }

    private static String normalizeLanguage(String language) {
        if (language == null) return "";
        return switch (language) {
            case "Python" -> "Python";
            case "Java" -> "Java";
            case "JavaScript", "JS" -> "JavaScript";
            case "TypeScript", "TS" -> "TypeScript";
            case "TSX" -> "TSX";
            case "Go" -> "Go";
            case "Rust" -> "Rust";
            case "C" -> "C";
            case "C++", "CPP", "Cpp" -> "C++";
            case "CSS" -> "CSS";
            case "Bash", "Shell", "ShellScript" -> "Bash";
            case "YAML" -> "YAML";
            case "JSON" -> "JSON";
            case "Ruby" -> "Ruby";
            case "HTML" -> "HTML";
            default -> language;
        };
    }
}
