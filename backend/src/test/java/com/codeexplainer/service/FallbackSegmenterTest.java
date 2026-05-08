package com.codeexplainer.service;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class FallbackSegmenterTest {

    @Test
    void segment_singleBlock_noSplit() {
        String code = "x = 1\ny = 2\nz = 3";
        List<CodeSegment> segments = FallbackSegmenter.segment(code, "test.py");
        assertEquals(1, segments.size());
        assertEquals(1, segments.get(0).startLine());
        assertEquals(3, segments.get(0).endLine());
    }

    @Test
    void segment_splitOnBlankLines() {
        String code = "import os\nimport sys\n\ndef main():\n    print('hello')";
        List<CodeSegment> segments = FallbackSegmenter.segment(code, "test.py");
        assertEquals(2, segments.size());
        assertEquals(1, segments.get(0).startLine());
        assertEquals(2, segments.get(0).endLine());
        assertEquals(4, segments.get(1).startLine());
        assertEquals(5, segments.get(1).endLine());
    }

    @Test
    void segment_multipleBlankLines() {
        String code = "a = 1\n\nb = 2\n\nc = 3";
        List<CodeSegment> segments = FallbackSegmenter.segment(code, "test.py");
        assertEquals(3, segments.size());
        assertEquals(1, segments.get(0).startLine());
        assertEquals(1, segments.get(0).endLine());
        assertEquals(3, segments.get(1).startLine());
        assertEquals(5, segments.get(2).endLine());
    }

    @Test
    void segment_emptyCode_returnsEmpty() {
        List<CodeSegment> segments = FallbackSegmenter.segment("", "test.py");
        assertTrue(segments.isEmpty());
    }

    @Test
    void segment_consecutiveBlankLines_singleGap() {
        String code = "x = 1\n\n\n\ny = 2";
        List<CodeSegment> segments = FallbackSegmenter.segment(code, "test.py");
        assertEquals(2, segments.size());
        assertEquals(1, segments.get(0).startLine());
        assertEquals(5, segments.get(1).endLine());
    }

    @Test
    void segment_generatesTitles() {
        String code = "import os\n\ndef hello():\n    pass";
        List<CodeSegment> segments = FallbackSegmenter.segment(code, "test.py");
        assertFalse(segments.get(0).title().isEmpty());
        assertFalse(segments.get(1).title().isEmpty());
    }

    @Test
    void segment_allBlankLines_returnsEmpty() {
        String code = "\n\n\n";
        List<CodeSegment> segments = FallbackSegmenter.segment(code, "test.py");
        assertTrue(segments.isEmpty());
    }
}
