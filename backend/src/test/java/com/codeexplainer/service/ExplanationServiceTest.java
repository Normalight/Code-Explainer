package com.codeexplainer.service;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class ExplanationServiceTest {

    private final ExplanationService explanationService = new ExplanationService(null);

    @Test
    void segmentCode_withNullChatClient_usesFallback() {
        String code = "import os\n\ndef main():\n    pass";
        List<CodeSegment> segments = explanationService.segmentCode(code, "main.py", "Python");

        assertNotNull(segments);
        assertEquals(2, segments.size());
        assertEquals("导入依赖", segments.get(0).title());
        assertEquals(1, segments.get(0).startLine());
        assertEquals(1, segments.get(0).endLine());
        assertEquals(3, segments.get(1).startLine());
        assertEquals(4, segments.get(1).endLine());
    }

    @Test
    void buildSegmentationPrompt_containsCodeAndMetadata() {
        String code = "def hello():\n    pass";
        String prompt = explanationService.buildSegmentationPrompt(code, "main.py", "Python");

        assertTrue(prompt.contains("main.py"));
        assertTrue(prompt.contains("Python"));
        assertTrue(prompt.contains("def hello"));
        assertTrue(prompt.contains("startLine"));
        assertTrue(prompt.contains("endLine"));
        assertTrue(prompt.contains("2"));
    }

    @Test
    void buildExplanationPrompt_containsContext() {
        String prompt = explanationService.buildExplanationPrompt(
                "print('hello')", 1, 1, "打印输出", "main.py",
                "Flask web app", "entry point"
        );

        assertTrue(prompt.contains("main.py"));
        assertTrue(prompt.contains("Flask web app"));
        assertTrue(prompt.contains("print"));
        assertTrue(prompt.contains("打印输出"));
        assertTrue(prompt.contains("entry point"));
        assertTrue(prompt.contains("第 1-1 行"));
    }

    @Test
    void buildExplanationPrompt_includesLineRange() {
        String prompt = explanationService.buildExplanationPrompt(
                "x=1\ny=2", 10, 20, "逻辑块", "app.py",
                "CLI tool", "core logic"
        );

        assertTrue(prompt.contains("第 10-20 行"));
        assertTrue(prompt.contains("逻辑块"));
    }

    @Test
    void buildQualityAssessmentPrompt_containsCode() {
        String prompt = explanationService.buildQualityAssessmentPrompt("x = 1", "app.py", "Python");

        assertTrue(prompt.contains("app.py"));
        assertTrue(prompt.contains("Python"));
        assertTrue(prompt.contains("x = 1"));
        assertTrue(prompt.contains("readability"));
        assertTrue(prompt.contains("security"));
        assertTrue(prompt.contains("grade"));
    }

    @Test
    void extractJson_findsArrayInMarkdown() {
        String response = "Here is the result:\n```json\n[{\"startLine\":1,\"endLine\":2,\"title\":\"test\",\"reason\":\"r\"}]\n```\nDone.";
        String json = explanationService.extractJson(response);

        assertTrue(json.startsWith("["));
        assertTrue(json.endsWith("]"));

        List<CodeSegment> segments = CodeSegment.fromJson(json);
        assertEquals(1, segments.size());
        assertEquals(1, segments.get(0).startLine());
    }
}
