package com.codeexplainer.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ExplanationServiceStructureTest {

    private final ExplanationService service = new ExplanationService(null);

    @Test
    void buildStructurePrompt_containsFileTree() {
        String fileTree = """
            src/
              main.py (50 lines, Python)
              utils.py (30 lines, Python)
            requirements.txt (5 lines)
            """;

        String prompt = service.buildStructurePrompt("test-project", fileTree);

        assertTrue(prompt.contains("test-project"));
        assertTrue(prompt.contains("main.py"));
        assertTrue(prompt.contains("projectType"));
    }
}
