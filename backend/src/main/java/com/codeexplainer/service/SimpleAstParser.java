package com.codeexplainer.service;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class SimpleAstParser {

    public static List<AstNode> parse(String code, String language) {
        if (code == null || code.isBlank()) return List.of();

        return switch (language) {
            case "Python" -> parsePython(code);
            case "Java" -> parseJava(code);
            case "TypeScript", "JavaScript" -> parseJs(code);
            case "Go" -> parseGo(code);
            default -> List.of();
        };
    }

    private static List<AstNode> parsePython(String code) {
        List<AstNode> nodes = new ArrayList<>();
        String[] lines = code.split("\n", -1);

        Pattern func = Pattern.compile("^\\s*def\\s+(\\w+)\\s*\\(");
        Pattern cls = Pattern.compile("^\\s*class\\s+(\\w+)");

        for (int i = 0; i < lines.length; i++) {
            Matcher m = func.matcher(lines[i]);
            if (m.find()) {
                nodes.add(new AstNode("function", m.group(1), i + 1));
                continue;
            }
            m = cls.matcher(lines[i]);
            if (m.find()) {
                nodes.add(new AstNode("class", m.group(1), i + 1));
            }
        }
        return nodes;
    }

    private static List<AstNode> parseJava(String code) {
        List<AstNode> nodes = new ArrayList<>();
        String[] lines = code.split("\n", -1);

        Pattern cls = Pattern.compile("(?:public|private|protected)?\\s*(?:static\\s+)?(?:final\\s+)?(?:abstract\\s+)?class\\s+(\\w+)");
        Pattern iface = Pattern.compile("(?:public\\s+)?interface\\s+(\\w+)");
        Pattern method = Pattern.compile("(?:public|private|protected)\\s+(?:static\\s+)?(?:\\w+(?:<[^>]+>)?)\\s+(\\w+)\\s*\\(");
        Pattern field = Pattern.compile("(?:private|protected)\\s+(?:final\\s+)?(?:\\w+)\\s+(\\w+)\\s*[;=]");

        for (int i = 0; i < lines.length; i++) {
            Matcher m = cls.matcher(lines[i]);
            if (m.find()) {
                nodes.add(new AstNode("class", m.group(1), i + 1));
                continue;
            }
            m = iface.matcher(lines[i]);
            if (m.find()) {
                nodes.add(new AstNode("interface", m.group(1), i + 1));
                continue;
            }
            m = method.matcher(lines[i]);
            if (m.find()) {
                nodes.add(new AstNode("method", m.group(1), i + 1));
            }
        }
        return nodes;
    }

    private static List<AstNode> parseJs(String code) {
        List<AstNode> nodes = new ArrayList<>();
        String[] lines = code.split("\n", -1);

        Pattern func = Pattern.compile("function\\s+(\\w+)\\s*\\(");
        Pattern arrow = Pattern.compile("(?:const|let|var)\\s+(\\w+)\\s*=\\s*(?:\\([^)]*\\)|[^=])\\s*=>");
        Pattern cls = Pattern.compile("class\\s+(\\w+)");
        Pattern namedExport = Pattern.compile("export\\s+(?:default\\s+)?function\\s+(\\w+)");

        for (int i = 0; i < lines.length; i++) {
            Matcher m = namedExport.matcher(lines[i]);
            if (m.find()) {
                nodes.add(new AstNode("function", m.group(1), i + 1));
                continue;
            }
            m = func.matcher(lines[i]);
            if (m.find()) {
                nodes.add(new AstNode("function", m.group(1), i + 1));
                continue;
            }
            m = cls.matcher(lines[i]);
            if (m.find()) {
                nodes.add(new AstNode("class", m.group(1), i + 1));
                continue;
            }
            m = arrow.matcher(lines[i]);
            if (m.find()) {
                nodes.add(new AstNode("variable", m.group(1), i + 1));
            }
        }
        return nodes;
    }

    private static List<AstNode> parseGo(String code) {
        List<AstNode> nodes = new ArrayList<>();
        String[] lines = code.split("\n", -1);

        Pattern func = Pattern.compile("func\\s+(?:\\([^)]+\\)\\s+)?(\\w+)\\s*\\(");
        Pattern struct = Pattern.compile("type\\s+(\\w+)\\s+struct");
        Pattern iface = Pattern.compile("type\\s+(\\w+)\\s+interface");

        for (int i = 0; i < lines.length; i++) {
            Matcher m = func.matcher(lines[i]);
            if (m.find()) {
                nodes.add(new AstNode("function", m.group(1), i + 1));
                continue;
            }
            m = struct.matcher(lines[i]);
            if (m.find()) {
                nodes.add(new AstNode("struct", m.group(1), i + 1));
                continue;
            }
            m = iface.matcher(lines[i]);
            if (m.find()) {
                nodes.add(new AstNode("interface", m.group(1), i + 1));
            }
        }
        return nodes;
    }
}
