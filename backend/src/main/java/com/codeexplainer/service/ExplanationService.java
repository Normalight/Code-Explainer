package com.codeexplainer.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;

import java.util.ArrayList;
import java.util.List;

@Service
@Slf4j
public class ExplanationService {

    private final ChatClient.Builder chatClientBuilder;

    public ExplanationService(ChatClient.Builder chatClientBuilder) {
        this.chatClientBuilder = chatClientBuilder;
    }

    private static String langDirective(String lang) {
        if ("en".equals(lang)) {
            return "\n\nIMPORTANT: All text output (titles, descriptions, explanations, summaries, issue titles/descriptions, module roles) MUST be in English. Keep technical terms as-is.\n";
        }
        return "\n\n重要：所有文本输出（标题、描述、解释、总结、问题描述、模块职责等）必须使用中文，技术术语保留英文原文。\n";
    }

    private static final int MAX_SEGMENTATION_LINES = 800;
    private static final int MAX_SEGMENTS = 15;
    private static final int MAX_EXPLANATION_LINES = 300;

    public List<CodeSegment> segmentCode(String code, String filePath, String language, String lang) {
        int lineCount = code.split("\n", -1).length;
        String prompt = buildSegmentationPrompt(code, filePath, language) + langDirective(lang);

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
                if (segments.size() > MAX_SEGMENTS) {
                    segments = mergeSegments(segments, MAX_SEGMENTS);
                }
                return segments;
            }

            log.warn("LLM segments invalid, using fallback: {}", errors);
        } catch (Exception e) {
            log.warn("LLM segmentation failed, using fallback: {}", e.getMessage());
        }

        return FallbackSegmenter.segment(code, filePath);
    }

    private List<CodeSegment> mergeSegments(List<CodeSegment> segments, int maxCount) {
        if (segments.size() <= maxCount) return segments;
        List<CodeSegment> merged = new ArrayList<>();
        int batchSize = (int) Math.ceil((double) segments.size() / maxCount);
        for (int i = 0; i < segments.size(); i += batchSize) {
            int end = Math.min(i + batchSize, segments.size());
            CodeSegment first = segments.get(i);
            CodeSegment last = segments.get(end - 1);
            String title = first.title();
            if (end - i > 1) title += " +" + (end - i - 1) + " blocks";
            merged.add(new CodeSegment(first.startLine(), last.endLine(), title, "merged"));
        }
        return merged;
    }

    public String explainSegment(String code, int startLine, int endLine,
                                  String title, String filePath,
                                  String projectContext, String fileRole, String lang) {
        String prompt = buildExplanationPrompt(code, startLine, endLine, title, filePath, projectContext, fileRole) + langDirective(lang);

        ChatClient chatClient = chatClientBuilder.build();
        return chatClient.prompt()
                .user(prompt)
                .call()
                .content();
    }

    public Flux<String> streamSegment(String code, int startLine, int endLine,
                                       String title, String filePath,
                                       String projectContext, String fileRole, String lang) {
        String prompt = buildExplanationPrompt(code, startLine, endLine, title, filePath, projectContext, fileRole) + langDirective(lang);

        ChatClient chatClient = chatClientBuilder.build();
        return chatClient.prompt()
                .user(prompt)
                .stream()
                .content();
    }

    public String buildSegmentationPrompt(String code, String filePath, String language) {
        String[] lines = code.split("\n", -1);
        int lineCount = lines.length;

        StringBuilder numberedCode = new StringBuilder();
        if (lineCount > MAX_SEGMENTATION_LINES) {
            int head = MAX_SEGMENTATION_LINES * 2 / 3;
            int tail = MAX_SEGMENTATION_LINES / 3;
            for (int i = 0; i < head; i++) {
                numberedCode.append(String.format("%4d | %s\n", i + 1, lines[i]));
            }
            numberedCode.append(String.format("      ... (省略 %d 行) ...\n", lineCount - head - tail));
            for (int i = lineCount - tail; i < lineCount; i++) {
                numberedCode.append(String.format("%4d | %s\n", i + 1, lines[i]));
            }
        } else {
            for (int i = 0; i < lines.length; i++) {
                numberedCode.append(String.format("%4d | %s\n", i + 1, lines[i]));
            }
        }

        String truncationNote = lineCount > MAX_SEGMENTATION_LINES
                ? String.format("\n注意：该文件共 %d 行，已截断展示前 %d 行和后 %d 行。请基于展示内容分段，行号范围必须覆盖 1-%d。", lineCount, MAX_SEGMENTATION_LINES * 2 / 3, MAX_SEGMENTATION_LINES / 3, lineCount)
                : "";

        return """
            你是一个代码分析专家。请将以下代码按逻辑块分段，只选值得解释的部分。

            ## 规则
            - 只对包含实际业务逻辑或关键功能的代码生成分段
            - 将相关的代码行合并为一个逻辑段，不要细分
            - 连续的 import/using 语句合为一段
            - 完整的函数/方法（含定义和函数体）合为一段
            - 完整的类定义（含所有方法）合为一段
            - 配置、常量、变量声明可以合并为一段
            - **必须跳过**以下无意义代码（不要为它们生成分段）：
              - return 0, return true, return null, return "", return this 等简单返回
              - exit() 调用
              - 纯赋值或常量定义（如 PI = 3.14, TIMEOUT = 30）
              - pass, break, continue
              - 纯括号/缩进闭合行（单独的 }、)、]）
              - 空的 catch/finally 块
              - 纯注释行
              - 简单的 getter/setter
              - 仅含 logging/print 的行
              - 空行
            - 每个文件的分段数量控制在 3-8 段，不要过多
            - 段与段之间可以有空行间隙

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
            """.formatted(filePath, language, lineCount, numberedCode) + truncationNote;
    }

    public String buildExplanationPrompt(String code, int startLine, int endLine,
                                          String title, String filePath,
                                          String projectContext, String fileRole) {
        return """
            你是一个代码解释助手，正在为开发者概括性地解释一个项目中的代码。

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
            - 用 2-4 句话概括这段代码的核心功能和意图
            - 重点说明"为什么这么做"而不是"做了什么"（代码本身已经说明了做了什么）
            - 如果涉及关键 API、设计模式或架构决策，指出并简要说明
            - 如果有明显的 bug 或安全隐患，用 ⚠️ 标注
            - 不要逐行解释，不要重复代码中已有的信息
            - 回复纯文本，可以包含行内 `code`，不要用 markdown 标题
            """.formatted(projectContext, filePath, fileRole, startLine, endLine, title, code);
    }

    public String buildQualityAssessmentPrompt(String code, String filePath, String language, String lang) {
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
            """.formatted(filePath, language, code) + langDirective(lang);
    }

    public String buildStructurePrompt(String projectName, String fileTree, String lang) {
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
              "projectType": "<项目类型>",
              "architecture": "<架构模式>",
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
            """.formatted(projectName, fileTree) + langDirective(lang);
    }

    public String analyzeProjectStructure(String projectName, String fileTree, String lang) {
        String prompt = buildStructurePrompt(projectName, fileTree, lang);

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
