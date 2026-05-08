package com.codeexplainer.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class AskService {

    private final ChatClient.Builder chatClientBuilder;

    public AskService(ChatClient.Builder chatClientBuilder) {
        this.chatClientBuilder = chatClientBuilder;
    }

    public String buildAskPrompt(String selectedCode, int startLine, int endLine,
                                  String filePath, String question,
                                  String projectName, String grepContext) {
        return buildAskPrompt(selectedCode, startLine, endLine, filePath, question, projectName, grepContext, "");
    }

    public String buildAskPrompt(String selectedCode, int startLine, int endLine,
                                  String filePath, String question,
                                  String projectName, String grepContext, String ragContext) {
        StringBuilder sb = new StringBuilder();
        sb.append("""
            你是一个代码解释助手。用户选中了一段代码并提出了一个问题，请用中文回答，技术术语保留英文。

            ## 项目信息
            - 项目：%s
            - 文件：%s

            ## 选中的代码（第 %d-%d 行）
            ```
            %s
            ```
            """.formatted(projectName, filePath, startLine, endLine, selectedCode));

        if (grepContext != null && !grepContext.isBlank()) {
            sb.append("""

                ## 代码上下文
                ```
                %s
                ```
                """.formatted(grepContext));
        }

        if (ragContext != null && !ragContext.isBlank()) {
            sb.append("""

                ## 项目中相关的代码片段（语义搜索结果）
                %s
                """.formatted(ragContext));
        }

        sb.append("""

            ## 用户的问题
            %s

            ## 回答要求
            - 直接回答问题，简洁明了
            - 如果需要引用代码，使用行内 `code`
            - 纯文本回复，不要用 markdown 标题
            """.formatted(question));

        return sb.toString();
    }

    public String extractCodeSurrounding(String code, int startLine, int endLine, int padding) {
        String[] lines = code.split("\n", -1);
        int from = Math.max(1, startLine - padding);
        int to = Math.min(lines.length, endLine + padding);

        StringBuilder sb = new StringBuilder();
        for (int i = from - 1; i < to; i++) {
            sb.append(String.format("%4d | %s\n", i + 1, lines[i]));
        }
        return sb.toString();
    }

    public String ask(String selectedCode, int startLine, int endLine,
                       String filePath, String question,
                       String projectName, String fullCode) {
        String grepContext = extractCodeSurrounding(fullCode, startLine, endLine, 10);
        String prompt = buildAskPrompt(selectedCode, startLine, endLine, filePath, question, projectName, grepContext);

        ChatClient chatClient = chatClientBuilder.build();
        return chatClient.prompt()
                .user(prompt)
                .call()
                .content();
    }

    public String ask(String selectedCode, int startLine, int endLine,
                       String filePath, String question,
                       String projectName, String fullCode, String ragContext) {
        String grepContext = extractCodeSurrounding(fullCode, startLine, endLine, 10);
        String prompt = buildAskPrompt(selectedCode, startLine, endLine, filePath, question, projectName, grepContext, ragContext);

        ChatClient chatClient = chatClientBuilder.build();
        return chatClient.prompt()
                .user(prompt)
                .call()
                .content();
    }
}
