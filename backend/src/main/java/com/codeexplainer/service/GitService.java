package com.codeexplainer.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class GitService {

    private final ExplanationService explanationService;

    public List<CommitInfo> listCommits(String repoPath, int limit) throws IOException, InterruptedException {
        ProcessBuilder pb = new ProcessBuilder("git", "log", "--max-count=" + limit,
                "--format=%H|%h|%an|%ae|%at|%s");
        pb.directory(Path.of(repoPath).toFile());
        pb.redirectErrorStream(true);
        Process process = pb.start();
        String output = new String(process.getInputStream().readAllBytes());
        process.waitFor();

        List<CommitInfo> commits = new ArrayList<>();
        for (String line : output.split("\n")) {
            if (line.isBlank()) continue;
            String[] parts = line.split("\\|", 6);
            if (parts.length >= 6) {
                commits.add(new CommitInfo(
                        parts[0], parts[1], parts[2], parts[3],
                        Long.parseLong(parts[4]), parts[5]
                ));
            }
        }
        return commits;
    }

    public String getDiff(String repoPath, String commitHash) throws IOException, InterruptedException {
        ProcessBuilder pb = new ProcessBuilder("git", "show", "--stat", "--patch", "--no-color", commitHash);
        pb.directory(Path.of(repoPath).toFile());
        pb.redirectErrorStream(true);
        Process process = pb.start();
        String output = new String(process.getInputStream().readAllBytes());
        process.waitFor();
        return output;
    }

    public String reviewCommit(String repoPath, String commitHash) throws IOException, InterruptedException {
        String diff = getDiff(repoPath, commitHash);
        String prompt = buildReviewPrompt(diff, commitHash);
        return explanationService.reviewCommit(prompt);
    }

    private String buildReviewPrompt(String diff, String commitHash) {
        return """
            你是一个代码审查专家。请审查以下 git commit 的变更。

            ## Commit Hash
            %s

            ## 变更内容（git diff）
            ```
            %s
            ```

            ## 审查要求
            请从以下维度进行审查：
            1. **代码正确性**：逻辑是否正确，边界情况是否处理
            2. **安全性**：是否引入安全隐患（注入、XSS、敏感信息泄露等）
            3. **性能**：是否存在性能问题
            4. **可维护性**：命名、结构、注释是否合理
            5. **最佳实践**：是否遵循语言/框架的最佳实践

            ## 输出 JSON
            {
              "summary": "<1-2句话总结这个 commit 做了什么>",
              "verdict": "<approve|request_changes|comment>",
              "scores": {
                "correctness": <1-5>,
                "security": <1-5>,
                "performance": <1-5>,
                "maintainability": <1-5>
              },
              "issues": [
                {
                  "severity": "<critical|warning|suggestion>",
                  "file": "<文件路径>",
                  "line": "<行号或范围>",
                  "title": "<问题标题>",
                  "description": "<问题描述和修复建议>"
                }
              ],
              "highlights": ["<做得好的地方1>", "<做得好的地方2>"]
            }

            ## 规则
            - 如果 diff 很长，重点关注核心逻辑变更
            - severity 分布：critical 必须修复，warning 建议修复，suggestion 可选改进
            - issues 不超过 10 个，只列最重要的
            - verdict 标准：approve=可以合并，request_changes=需要修改，comment=有小问题但可以接受
            """.formatted(commitHash, diff.length() > 30000 ? diff.substring(0, 30000) + "\n... (truncated)" : diff);
    }

    public record CommitInfo(String hash, String shortHash, String author, String email,
                             long timestamp, String message) {}
}
