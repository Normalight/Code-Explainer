package com.codeexplainer.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public record CodeSegment(int startLine, int endLine, String title, String reason) {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    public static List<CodeSegment> fromJson(String json) {
        try {
            return MAPPER.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse segment JSON: " + e.getMessage(), e);
        }
    }

    public static String toJsonArray(List<CodeSegment> segments) {
        try {
            return MAPPER.writeValueAsString(segments);
        } catch (Exception e) {
            throw new RuntimeException("Failed to serialize segments: " + e.getMessage(), e);
        }
    }

    public static List<String> validate(List<CodeSegment> segments, int totalLines) {
        List<String> errors = new ArrayList<>();

        List<CodeSegment> sorted = new ArrayList<>(segments);
        Collections.sort(sorted, (a, b) -> Integer.compare(a.startLine, b.startLine));

        for (int i = 0; i < sorted.size(); i++) {
            CodeSegment seg = sorted.get(i);

            if (seg.startLine > seg.endLine) {
                errors.add("Segment " + i + ": startLine > endLine (" + seg.startLine + " > " + seg.endLine + ")");
            }
            if (seg.startLine < 1 || seg.endLine > totalLines) {
                errors.add("Segment " + i + ": lines out of bounds (1-" + totalLines + ")");
            }
            if (i > 0) {
                CodeSegment prev = sorted.get(i - 1);
                if (seg.startLine <= prev.endLine) {
                    errors.add("Segments " + (i - 1) + " and " + i + " overlap (" +
                            prev.startLine + "-" + prev.endLine + " vs " + seg.startLine + "-" + seg.endLine + ")");
                }
            }
        }

        return errors;
    }
}
