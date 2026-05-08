package com.codeexplainer.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class SummaryCompressionService {

    private final ChatClient.Builder chatClientBuilder;

    public String compress(List<ChatMessage> messages) {
        if (messages.isEmpty()) return "";

        StringBuilder sb = new StringBuilder();
        for (ChatMessage msg : messages) {
            sb.append(msg.role().equals("user") ? "用户" : "助手")
                    .append("：").append(msg.content()).append("\n");
        }

        String prompt = """
            请将以下对话历史压缩为一段简洁的摘要，保留关键信息和上下文。用中文输出，技术术语保留英文。

            %s

            ## 要求
            - 保留所有关键的技术决策、文件路径、代码片段引用
            - 忽略寒暄和重复内容
            - 不超过 200 字
            """.formatted(sb.toString());

        try {
            ChatClient chatClient = chatClientBuilder.build();
            return chatClient.prompt()
                    .user(prompt)
                    .call()
                    .content();
        } catch (Exception e) {
            log.warn("Summary compression failed: {}", e.getMessage());
            return sb.toString();
        }
    }
}
