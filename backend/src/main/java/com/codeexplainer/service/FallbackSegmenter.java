package com.codeexplainer.service;

import java.util.ArrayList;
import java.util.List;

public class FallbackSegmenter {

    public static List<CodeSegment> segment(String code, String filePath) {
        if (code == null || code.isBlank()) {
            return List.of();
        }

        String[] lines = code.split("\n", -1);
        List<Integer> blockStarts = new ArrayList<>();
        List<Integer> blockEnds = new ArrayList<>();

        boolean inBlock = false;
        int blockStart = -1;

        for (int i = 0; i < lines.length; i++) {
            boolean isBlank = lines[i].isBlank();
            if (!isBlank && !inBlock) {
                blockStart = i + 1;
                inBlock = true;
            } else if (isBlank && inBlock) {
                blockStarts.add(blockStart);
                blockEnds.add(i);
                inBlock = false;
            }
        }

        if (inBlock) {
            blockStarts.add(blockStart);
            blockEnds.add(lines.length);
        }

        List<CodeSegment> segments = new ArrayList<>();
        for (int i = 0; i < blockStarts.size(); i++) {
            int start = blockStarts.get(i);
            int end = blockEnds.get(i);
            String title = generateTitle(lines, start - 1, end);
            segments.add(new CodeSegment(start, end, title, "fallback segment"));
        }

        return segments;
    }

    private static String generateTitle(String[] lines, int startIdx, int endLine) {
        if (startIdx >= lines.length) return "代码块";
        String firstLine = lines[startIdx].strip();
        if (firstLine.startsWith("import ") || firstLine.startsWith("from ")) return "导入依赖";
        if (firstLine.startsWith("def ") || firstLine.startsWith("function ")) return "函数定义";
        if (firstLine.startsWith("class ")) return "类定义";
        if (firstLine.startsWith("@")) return "装饰器/注解";
        if (firstLine.startsWith("#") || firstLine.startsWith("//")) return "注释";
        if (firstLine.startsWith("if ") || firstLine.startsWith("if(")) return "条件判断";
        if (firstLine.startsWith("for ") || firstLine.startsWith("for(")) return "循环";
        if (firstLine.startsWith("while ")) return "循环";
        if (firstLine.startsWith("try") || firstLine.startsWith("catch")) return "异常处理";
        if (firstLine.contains("=") && !firstLine.contains("==")) return "变量赋值";
        return "代码块";
    }
}
