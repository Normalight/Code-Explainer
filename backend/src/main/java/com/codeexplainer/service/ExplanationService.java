package com.codeexplainer.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@Slf4j
public class ExplanationService {

    private final ChatClient.Builder chatClientBuilder;

    public ExplanationService(ChatClient.Builder chatClientBuilder) {
        this.chatClientBuilder = chatClientBuilder;
    }

    public List<CodeSegment> segmentCode(String code, String filePath, String language) {
        int lineCount = code.split("\n", -1).length;
        String prompt = buildSegmentationPrompt(code, filePath, language);

        try {
            if (chatClientBuilder == null) throw new RuntimeException("No ChatClient configured");
            ChatClient chatClient = chatClientBuilder.build();
            String response = chatClient.prompt()
                    .user(prompt)
                    .call()
                    .content();

            List<CodeSegment> segments = CodeSegment.fromJson(extractJson(response));
            List<String> errors = CodeSegment.validate(segments, lineCount);

            if (errors.isEmpty()) {
                return segments;
            }

            log.warn("LLM segments invalid, using fallback: {}", errors);
        } catch (Exception e) {
            log.warn("LLM segmentation failed, using fallback: {}", e.getMessage());
        }

        return FallbackSegmenter.segment(code, filePath);
    }

    public String explainSegment(String code, int startLine, int endLine,
                                  String title, String filePath,
                                  String projectContext, String fileRole) {
        String prompt = buildExplanationPrompt(code, startLine, endLine, title, filePath, projectContext, fileRole);

        ChatClient chatClient = chatClientBuilder.build();
        return chatClient.prompt()
                .user(prompt)
                .call()
                .content();
    }

    public String buildSegmentationPrompt(String code, String filePath, String language) {
        int lineCount = code.split("\n", -1).length;

        StringBuilder numberedCode = new StringBuilder();
        String[] lines = code.split("\n", -1);
        for (int i = 0; i < lines.length; i++) {
            numberedCode.append(String.format("%4d | %s\n", i + 1, lines[i]));
        }

        return """
            你是一个代码分析专家。请将以下代码按逻辑块分段，但只选值得解释的部分。

            ## 规则
            - 按功能逻辑分段，不要逐行分段
            - 连续的 import 语句合为一段
            - 函数/类的定义 + 函数体合为一段
            - 全局变量赋值可以和相邻语句合并
            - 空行、纯括号行不单独分段，归属到前后相邻段
            - **跳过不需要解释的代码**，以下代码不需要生成解释段：
              - 简单的 return 语句（如 return 0, return true, return null）
              - exit() 调用
              - 纯赋值或常量定义（如 PI = 3.14）
              - 简单的 pass、break、continue
              - 只有大括号/缩进闭合的行
              - 空的 catch/finally 块
              - 纯注释行（但重要的注释可以和相邻代码合并）
            - 只对包含实际逻辑的代码生成分段
            - 段与段之间可以有空行间隙（这些行不归属任何段）

            ## 输出格式
            只返回 JSON 数组，不要其他文字，每个元素：
            {"startLine": <起始行号>, "endLine": <结束行号>, "title": "<简短标题>", "reason": "<为什么这段代码值得解释>"}

            ## 文件信息
            - 文件路径：%s
            - 语言：%s
            - 总行数：%d

            ## 代码内容
            ```
            %s
            ```
            """.formatted(filePath, language, lineCount, numberedCode);
    }

    public String buildExplanationPrompt(String code, int startLine, int endLine,
                                          String title, String filePath,
                                          String projectContext, String fileRole) {
        return """
            你是一个代码解释助手，正在为开发者解释一个项目中的代码文件。
            请用中文解释，技术术语保留英文原文。

            ## 项目上下文
            - 项目类型：%s
            - 文件路径：%s
            - 该文件在项目中的作用：%s

            ## 当前代码段
            这是文件中第 %d-%d 行，属于「%s」部分：

            ```
            %s
            ```

            ## 解释要求
            - 用 1-3 句话解释这段代码做了什么
            - 如果涉及关键 API 或设计模式，指出并简要说明
            - 如果有潜在的 bug 或不规范的写法，用 ⚠️ 标注
            - 回复纯文本，可以包含行内 `code`，不要用 markdown 标题
            """.formatted(projectContext, filePath, fileRole, startLine, endLine, title, code);
    }

    public String buildQualityAssessmentPrompt(String code, String filePath, String language) {
        return """
            你是一个代码审查专家。请对以下文件进行质量评估。

            ## 文件信息
            - 文件路径：%s
            - 语言：%s

            ## 代码内容
            ```
            %s
            ```

            ## 评估维度
            1. 可读性（命名、注释、结构清晰度）
            2. 复杂度（函数长度、嵌套深度、圈复杂度）
            3. 规范性（编码风格、最佳实践遵循情况）
            4. 安全性（注入、敏感信息暴露、权限问题）

            ## 输出 JSON
            {
              "grade": "<A|B|C|D>",
              "scores": {
                "readability": <1-5>,
                "complexity": <1-5>,
                "convention": <1-5>,
                "security": <1-5>
              },
              "summary": "<2-3 句话总体评价>",
              "issues": [
                {
                  "severity": "<critical|warning|suggestion>",
                  "lineStart": <起始行>,
                  "lineEnd": <结束行>,
                  "title": "<问题标题>",
                  "description": "<问题描述和修复建议>"
                }
              ]
            }

            ## 规则
            - grade 标准：A=优秀 B=良好 C=一般 D=需改进
            - issues 按严重程度排序：critical → warning → suggestion
            - 每个维度必须给出 1-5 分，不要都是 5 分或都是 3 分
            - issues 不超过 10 个，只列最重要的
            """.formatted(filePath, language, code);
    }

    public String buildStructurePrompt(String projectName, String fileTree) {
        return """
            你是一个项目结构分析专家。请分析以下项目的结构。

            ## 项目名称
            %s

            ## 文件树
            ```
            %s
            ```

            ## 输出 JSON
            {
              "projectType": "<项目类型，如 Flask web app, React SPA, Spring Boot API 等>",
              "architecture": "<架构模式，如 MVC, 微服务, 单体等>",
              "entryPoints": ["<入口文件列表>"],
              "modules": [
                {
                  "path": "<目录或文件路径>",
                  "role": "<该模块的职责描述>"
                }
              ],
              "techStack": ["<使用的技术/框架列表>"],
              "summary": "<2-3 句话总体描述>"
            }

            ## 规则
            - 只返回 JSON，不要其他文字
            - 基于文件名、目录结构、语言推断项目类型
            - modules 列出主要模块，不要逐个文件列举
            """.formatted(projectName, fileTree);
    }

    public String analyzeProjectStructure(String projectName, String fileTree) {
        String prompt = buildStructurePrompt(projectName, fileTree);

        try {
            ChatClient chatClient = chatClientBuilder.build();
            return chatClient.prompt()
                    .user(prompt)
                    .call()
                    .content();
        } catch (Exception e) {
            throw new RuntimeException("Project structure analysis failed: " + e.getMessage(), e);
        }
    }

    public String extractJson(String response) {
        int start = response.indexOf('[') != -1 ? response.indexOf('[') : response.indexOf('{');
        char openChar = response.indexOf('[') != -1 ? ']' : '}';
        int end = response.lastIndexOf(openChar);
        if (start >= 0 && end > start) {
            return response.substring(start, end + 1);
        }
        throw new RuntimeException("No JSON found in response");
    }

    public String reviewCommit(String prompt) {
        ChatClient chatClient = chatClientBuilder.build();
        return chatClient.prompt()
                .user(prompt)
                .call()
                .content();
    }
}
