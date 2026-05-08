package com.codeexplainer.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class AskServiceTest {

    private final AskService askService = new AskService(null);

    @Test
    void buildAskPrompt_containsCodeAndQuestion() {
        String prompt = askService.buildAskPrompt(
                "def hello():\n    print('hello')",
                1, 3,
                "main.py",
                "What does this function do?",
                "Flask web app",
                ""
        );

        assertTrue(prompt.contains("def hello"));
        assertTrue(prompt.contains("What does this function do?"));
        assertTrue(prompt.contains("main.py"));
        assertTrue(prompt.contains("1-3"));
        assertTrue(prompt.contains("Flask web app"));
    }

    @Test
    void buildAskPrompt_includesContextWhenProvided() {
        String prompt = askService.buildAskPrompt(
                "x = 1",
                1, 1,
                "app.py",
                "Why use x=1?",
                "MyApp",
                "from utils import helper\nhelper(x)"
        );

        assertTrue(prompt.contains("Why use x=1?"));
        assertTrue(prompt.contains("from utils import helper"));
    }

    @Test
    void buildAskPrompt_worksWithEmptyContext() {
        String prompt = askService.buildAskPrompt(
                "pass",
                5, 5,
                "test.py",
                "Why pass?",
                "project",
                ""
        );

        assertTrue(prompt.contains("Why pass?"));
        assertFalse(prompt.contains("Related code"));
    }

    @Test
    void extractCodeSurrounding_extractsRange() {
        String code = "line1\nline2\nline3\nline4\nline5\nline6\nline7\nline8\nline9\nline10";
        String result = askService.extractCodeSurrounding(code, 3, 3, 2);

        assertTrue(result.contains("line1"));
        assertTrue(result.contains("line5"));
        assertFalse(result.contains("line6"));
    }

    @Test
    void extractCodeSurrounding_clampsAtBoundaries() {
        String code = "line1\nline2\nline3";
        String result = askService.extractCodeSurrounding(code, 1, 1, 5);

        assertTrue(result.contains("line1"));
        assertTrue(result.contains("line3"));
    }
}
