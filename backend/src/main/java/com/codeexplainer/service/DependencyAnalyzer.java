package com.codeexplainer.service;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

public class DependencyAnalyzer {

    public static List<String> parseImports(String code, String language) {
        if (code == null || code.isBlank()) return List.of();

        return switch (language) {
            case "Python" -> parsePythonImports(code);
            case "Java" -> parseJavaImports(code);
            case "TypeScript", "JavaScript" -> parseJsImports(code);
            case "Go" -> parseGoImports(code);
            default -> List.of();
        };
    }

    private static List<String> parsePythonImports(String code) {
        List<String> result = new ArrayList<>();
        Pattern fromImport = Pattern.compile("^from\\s+([\\w.]+)\\s+import", Pattern.MULTILINE);
        Pattern plainImport = Pattern.compile("^import\\s+([\\w.]+)", Pattern.MULTILINE);

        Matcher m = fromImport.matcher(code);
        while (m.find()) result.add(m.group(1));

        m = plainImport.matcher(code);
        while (m.find()) result.add(m.group(1).split("\\.")[0]);

        return result;
    }

    private static List<String> parseJavaImports(String code) {
        List<String> result = new ArrayList<>();
        Pattern p = Pattern.compile("^import\\s+([\\w.]+)\\s*;", Pattern.MULTILINE);
        Matcher m = p.matcher(code);
        while (m.find()) result.add(m.group(1));
        return result;
    }

    private static List<String> parseJsImports(String code) {
        List<String> result = new ArrayList<>();
        // import ... from '...'
        Pattern es6 = Pattern.compile("import\\s+[\\s\\S]*?from\\s+['\"](.+?)['\"]");
        // import '...'
        Pattern sideEffect = Pattern.compile("import\\s+['\"](.+?)['\"]");
        // require('...')
        Pattern commonjs = Pattern.compile("require\\s*\\(\\s*['\"](.+?)['\"]\\s*\\)");

        Matcher m = es6.matcher(code);
        while (m.find()) result.add(m.group(1));

        m = sideEffect.matcher(code);
        while (m.find()) {
            if (!result.contains(m.group(1))) result.add(m.group(1));
        }

        m = commonjs.matcher(code);
        while (m.find()) {
            if (!result.contains(m.group(1))) result.add(m.group(1));
        }

        return result;
    }

    private static List<String> parseGoImports(String code) {
        List<String> result = new ArrayList<>();
        Pattern single = Pattern.compile("^import\\s+\"([^\"]+)\"", Pattern.MULTILINE);
        Pattern multi = Pattern.compile("\"([^\"]+)\"");

        Matcher singleMatch = single.matcher(code);
        while (singleMatch.find()) result.add(singleMatch.group(1));

        // Multi-line import block
        Pattern block = Pattern.compile("import\\s*\\((.+?)\\)", Pattern.DOTALL);
        Matcher blockMatch = block.matcher(code);
        while (blockMatch.find()) {
            Matcher inner = multi.matcher(blockMatch.group(1));
            while (inner.find()) result.add(inner.group(1));
        }

        return result;
    }

    public static String resolveImport(String importPath, String language, Map<String, String> projectFiles) {
        return resolveImport(importPath, language, projectFiles, null);
    }

    public static String resolveImport(String importPath, String language, Map<String, String> projectFiles, String callerPath) {
        Set<String> stdLibs = getStdLibs(language);
        if (stdLibs.contains(importPath) || stdLibs.contains(importPath.split("[./\\\\]")[0])) {
            return null;
        }

        // Resolve relative imports based on caller file directory
        String resolvedImport = importPath;
        if (callerPath != null && importPath.startsWith(".")) {
            String callerDir = callerPath.contains("/") ? callerPath.substring(0, callerPath.lastIndexOf('/')) : "";
            resolvedImport = callerDir + "/" + importPath;
            resolvedImport = normalizePath(resolvedImport);
        }

        // Convert import path to possible file paths
        Set<String> candidates = generateCandidates(resolvedImport, language);

        for (String candidate : candidates) {
            if (projectFiles.containsKey(candidate)) {
                return candidate;
            }
        }

        // Fuzzy match: check if any project file ends with the import path
        String normalizedImport = resolvedImport.replace('.', '/').replace('\\', '/');
        for (String filePath : projectFiles.keySet()) {
            String normalized = filePath.replace('\\', '/');
            if (normalized.endsWith(normalizedImport + ".py") ||
                normalized.endsWith(normalizedImport + ".java") ||
                normalized.endsWith(normalizedImport + ".ts") ||
                normalized.endsWith(normalizedImport + ".tsx") ||
                normalized.endsWith(normalizedImport + ".js")) {
                return filePath;
            }
        }

        return null;
    }

    private static Set<String> generateCandidates(String importPath, String language) {
        Set<String> candidates = new LinkedHashSet<>();
        String withExt = importPath.replace('.', '/').replace('\\', '/');

        String[] extensions = switch (language) {
            case "Python" -> new String[]{".py"};
            case "Java" -> new String[]{".java"};
            case "TypeScript" -> new String[]{".ts", ".tsx", ".d.ts"};
            case "JavaScript" -> new String[]{".js", ".jsx", ".mjs"};
            case "Go" -> new String[]{"/..."};  // Go packages
            default -> new String[]{};
        };

        for (String ext : extensions) {
            candidates.add(withExt + ext);
            candidates.add("src/" + withExt + ext);
            candidates.add("src/main/" + withExt + ext);
            candidates.add("src/main/java/" + withExt + ext);
            candidates.add("src/main/python/" + withExt + ext);
        }

        // For relative JS/TS imports
        if (importPath.startsWith(".")) {
            String relative = importPath.replaceAll("^\\./", "").replaceAll("^\\.\\./", "");
            for (String ext : extensions) {
                candidates.add(relative + ext);
            }
        }

        return candidates;
    }

    private static Set<String> getStdLibs(String language) {
        return switch (language) {
            case "Python" -> Set.of("os", "sys", "json", "re", "math", "time", "datetime",
                    "collections", "functools", "itertools", "logging", "pathlib",
                    "typing", "abc", "io", "hashlib", "copy", "dataclasses");
            case "Java" -> Set.of("java", "javax", "sun", "org.w3c");
            case "TypeScript", "JavaScript" -> Set.of("react", "react-dom", "vue", "express",
                    "fs", "path", "http", "https", "url", "util", "stream", "events",
                    "child_process", "os", "crypto", "buffer", "assert", "zlib",
                    "@types", "next", "webpack", "vite", "tailwindcss");
            case "Go" -> Set.of("fmt", "os", "io", "net", "http", "strings", "strconv",
                    "time", "math", "errors", "context", "sync", "encoding",
                    "log", "path", "runtime", "unicode", "bufio", "bytes");
            default -> Set.of();
        };
    }

    private static String normalizePath(String path) {
        String[] parts = path.split("/");
        java.util.Stack<String> stack = new java.util.Stack<>();
        for (String part : parts) {
            if (part.equals("..") && !stack.isEmpty()) {
                stack.pop();
            } else if (!part.equals(".") && !part.isEmpty()) {
                stack.push(part);
            }
        }
        return String.join("/", stack);
    }
}
