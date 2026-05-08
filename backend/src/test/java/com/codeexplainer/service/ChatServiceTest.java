package com.codeexplainer.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ChatServiceTest {

    private final ChatService chatService = new ChatService(null);

    @Test
    void buildChatPrompt_containsQuestionAndContext() {
        String prompt = chatService.buildChatPrompt(
                "How does authentication work?",
                "auth.py defines login(), logout()",
                "def login(user, pass):\n    token = jwt.encode(...)"
        );

        assertTrue(prompt.contains("How does authentication work?"));
        assertTrue(prompt.contains("auth.py defines login"));
        assertTrue(prompt.contains("jwt.encode"));
    }

    @Test
    void buildChatPrompt_worksWithEmptyContext() {
        String prompt = chatService.buildChatPrompt(
                "What is this project?",
                "",
                ""
        );

        assertTrue(prompt.contains("What is this project?"));
        assertFalse(prompt.contains("Related code"));
    }

    @Test
    void buildChatPrompt_withHistory_includesPreviousMessages() {
        String prompt = chatService.buildChatPrompt(
                "And the logout?",
                "auth.py defines login(), logout()",
                "def logout(): session.clear()",
                java.util.List.of(
                        new ChatMessage("user", "How does login work?"),
                        new ChatMessage("assistant", "It uses JWT tokens.")
                )
        );

        assertTrue(prompt.contains("How does login work?"));
        assertTrue(prompt.contains("It uses JWT tokens"));
        assertTrue(prompt.contains("And the logout?"));
    }
}
