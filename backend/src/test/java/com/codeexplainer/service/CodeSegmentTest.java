package com.codeexplainer.service;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class CodeSegmentTest {

    @Test
    void parseSegments_validJson_returnsSegmentList() {
        String json = """
            [
              {"startLine": 1, "endLine": 2, "title": "导入依赖", "reason": "import statements"},
              {"startLine": 4, "endLine": 5, "title": "应用初始化", "reason": "variable assignments"},
              {"startLine": 7, "endLine": 12, "title": "路由定义", "reason": "function definitions"}
            ]
            """;

        List<CodeSegment> segments = CodeSegment.fromJson(json);

        assertEquals(3, segments.size());
        assertEquals(1, segments.get(0).startLine());
        assertEquals(2, segments.get(0).endLine());
        assertEquals("导入依赖", segments.get(0).title());
        assertEquals(7, segments.get(2).startLine());
        assertEquals(12, segments.get(2).endLine());
    }

    @Test
    void parseSegments_emptyArray_returnsEmptyList() {
        String json = "[]";
        List<CodeSegment> segments = CodeSegment.fromJson(json);
        assertTrue(segments.isEmpty());
    }

    @Test
    void validateSegments_validCoverage_passes() {
        List<CodeSegment> segments = List.of(
                new CodeSegment(1, 2, "导入", ""),
                new CodeSegment(4, 10, "主体", "")
        );

        List<String> errors = CodeSegment.validate(segments, 10);

        assertTrue(errors.isEmpty());
    }

    @Test
    void validateSegments_overlappingLines_fails() {
        List<CodeSegment> segments = List.of(
                new CodeSegment(1, 5, "A", ""),
                new CodeSegment(3, 8, "B", "")
        );

        List<String> errors = CodeSegment.validate(segments, 10);

        assertFalse(errors.isEmpty());
        assertTrue(errors.get(0).contains("overlap"));
    }

    @Test
    void validateSegments_outOfBounds_fails() {
        List<CodeSegment> segments = List.of(
                new CodeSegment(1, 20, "all", "")
        );

        List<String> errors = CodeSegment.validate(segments, 10);

        assertFalse(errors.isEmpty());
        assertTrue(errors.stream().anyMatch(e -> e.contains("out of bounds")));
    }

    @Test
    void validateSegments_startAfterEnd_fails() {
        List<CodeSegment> segments = List.of(
                new CodeSegment(5, 3, "bad", "")
        );

        List<String> errors = CodeSegment.validate(segments, 10);

        assertFalse(errors.isEmpty());
        assertTrue(errors.stream().anyMatch(e -> e.contains("startLine > endLine")));
    }
}
