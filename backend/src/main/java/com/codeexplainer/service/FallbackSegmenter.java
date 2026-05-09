package com.codeexplainer.service;

import java.util.ArrayList;
import java.util.List;

public class FallbackSegmenter {

    private static final int MIN_BLOCK_LINES = 3;
    private static final int MAX_SEGMENTS = 15;

    public static List<CodeSegment> segment(String code, String filePath) {
        if (code == null || code.isBlank()) {
            return List.of();
        }

        String[] lines = code.split("\n", -1);
        List<int[]> rawBlocks = new ArrayList<>();

        boolean inBlock = false;
        int blockStart = -1;

        for (int i = 0; i < lines.length; i++) {
            boolean isBlank = lines[i].isBlank();
            if (!isBlank && !inBlock) {
                blockStart = i + 1;
                inBlock = true;
            } else if (isBlank && inBlock) {
                rawBlocks.add(new int[]{blockStart, i});
                inBlock = false;
            }
        }
        if (inBlock) {
            rawBlocks.add(new int[]{blockStart, lines.length});
        }

        List<int[]> filtered = new ArrayList<>();
        for (int[] block : rawBlocks) {
            if (isTrivialBlock(lines, block[0] - 1, block[1])) continue;
            if (filtered.isEmpty() || block[1] - block[0] + 1 >= MIN_BLOCK_LINES) {
                filtered.add(block);
            } else {
                int[] prev = filtered.get(filtered.size() - 1);
                if (block[0] - prev[1] <= 2) {
                    prev[1] = block[1];
                } else {
                    filtered.add(block);
                }
            }
        }

        if (filtered.size() > MAX_SEGMENTS) {
            List<int[]> merged = new ArrayList<>();
            int batchSize = (int) Math.ceil((double) filtered.size() / MAX_SEGMENTS);
            for (int i = 0; i < filtered.size(); i += batchSize) {
                int end = Math.min(i + batchSize, filtered.size());
                merged.add(new int[]{filtered.get(i)[0], filtered.get(end - 1)[1]});
            }
            filtered = merged;
        }

        List<CodeSegment> segments = new ArrayList<>();
        for (int[] block : filtered) {
            String title = generateTitle(lines, block[0] - 1, block[1]);
            segments.add(new CodeSegment(block[0], block[1], title, "fallback segment"));
        }
        return segments;
    }

    private static boolean isTrivialBlock(String[] lines, int startIdx, int endLine) {
        for (int i = startIdx; i < endLine && i < lines.length; i++) {
            String line = lines[i].strip();
            if (line.isEmpty()) continue;
            if (line.equals("}") || line.equals("});") || line.equals("},") || line.equals(")")) continue;
            if (line.startsWith("//") || line.startsWith("#") || line.startsWith("/*") || line.startsWith("*")) continue;
            return false;
        }
        return true;
    }

    private static String generateTitle(String[] lines, int startIdx, int endLine) {
        if (startIdx >= lines.length) return "Code Block";
        String firstLine = lines[startIdx].strip();
        if (firstLine.startsWith("import ") || firstLine.startsWith("from ")) return "Imports";
        if (firstLine.startsWith("def ") || firstLine.startsWith("function ") || firstLine.startsWith("func ")) return "Function";
        if (firstLine.startsWith("class ") || firstLine.startsWith("struct ") || firstLine.startsWith("interface ")) return "Class/Interface";
        if (firstLine.startsWith("@")) return "Annotated Block";
        if (firstLine.startsWith("export ") || firstLine.startsWith("pub ")) return "Export";
        if (firstLine.startsWith("if ") || firstLine.startsWith("if(") || firstLine.startsWith("switch ")) return "Conditional";
        if (firstLine.startsWith("for ") || firstLine.startsWith("for(") || firstLine.startsWith("while ")) return "Loop";
        if (firstLine.startsWith("try") || firstLine.startsWith("catch")) return "Error Handling";
        if (firstLine.contains("=") && !firstLine.contains("==")) return "Variables";
        return "Code Block";
    }
}
