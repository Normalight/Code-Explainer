package com.codeexplainer.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@Slf4j
public class ChatService {

    private final ChatClient.Builder chatClientBuilder;

    public ChatService(ChatClient.Builder chatClientBuilder) {
        this.chatClientBuilder = chatClientBuilder;
    }

    public String buildChatPrompt(String question, String structureContext, String grepContext) {
        return buildChatPrompt(question, structureContext, grepContext, List.of());
    }

    public String buildChatPrompt(String question, String structureContext,
                                   String grepContext, List<ChatMessage> history) {
        StringBuilder sb = new StringBuilder();
        sb.append("""
            你是一个代码解释助手，正在帮助开发者理解一个项目。请用中文回答，技术术语保留英文。

            """);

        if (structureContext != null && !structureContext.isBlank()) {
            sb.append("## 项目结构\n").append(structureContext).append("\n\n");
        }

        if (grepContext != null && !grepContext.isBlank()) {
            sb.append("## 相关代码\n```\n").append(grepContext).append("\n```\n\n");
        }

        if (!history.isEmpty()) {
            sb.append("## 对话历史\n");
            for (ChatMessage msg : history) {
                sb.append(msg.role().equals("user") ? "用户" : "助手")
                        .append("：").append(msg.content()).append("\n");
            }
            sb.append("\n");
        }

        sb.append("## 用户的问题\n").append(question).append("""

            ## 回答要求
            - 回答要具体，引用相关文件路径或代码
            - 如果需要引用代码，使用行内 `code`
            - 纯文本回复，不要用 markdown 标题
            """);

        return sb.toString();
    }

    public String chat(String question, String structureContext,
                        String grepContext, List<ChatMessage> history) {
        String prompt = buildChatPrompt(question, structureContext, grepContext, history);
        ChatClient chatClient = chatClientBuilder.build();
        return chatClient.prompt()
                .user(prompt)
                .call()
                .content();
    }
}
