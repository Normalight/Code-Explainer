package com.codeexplainer.controller;

import com.codeexplainer.model.Project;
import com.codeexplainer.model.ProjectFile;
import com.codeexplainer.repository.ExplanationCacheRepository;
import com.codeexplainer.repository.ProjectFileRepository;
import com.codeexplainer.repository.ProjectRepository;
import com.codeexplainer.service.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/projects")
@RequiredArgsConstructor
public class ExplanationController {

    private final ProjectRepository projectRepository;
    private final ProjectFileRepository projectFileRepository;
    private final ExplanationCacheRepository explanationCacheRepository;
    private final FileService fileService;
    private final ExplanationService explanationService;
    private final ExplanationCacheService cacheService;

    @GetMapping(value = "/{id}/explain", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Object explain(@PathVariable Long id, @RequestParam String filePath, @RequestParam(defaultValue = "zh") String lang) {
        Project project = projectRepository.findById(id).orElse(null);
        if (project == null) return ResponseEntity.notFound().build();

        ProjectFile file = projectFileRepository.findByProjectAndPath(project, filePath).orElse(null);
        if (file == null) return ResponseEntity.notFound().build();

        String code = fileService.getFileContent(id, filePath);
        String contentHash = hashContent(code);

        // Check cache
        var cached = cacheService.get(id, filePath, contentHash);
        if (cached.isPresent() && cached.get().segments() != null) {
            return emitCached(cached.get());
        }

        SseEmitter emitter = new SseEmitter(300_000L);
        ExecutorService executor = Executors.newSingleThreadExecutor();
        executor.execute(() -> {
            try {
                List<CodeSegment> segments = explanationService.segmentCode(code, filePath, file.getLanguage(), lang);
                String segmentsJson = CodeSegment.toJsonArray(segments);
                List<String> explanationList = new ArrayList<>();

                for (CodeSegment segment : segments) {
                    String[] lines = code.split("\n", -1);
                    StringBuilder segmentCode = new StringBuilder();
                    int segLineCount = segment.endLine() - segment.startLine() + 1;
                    for (int i = segment.startLine() - 1; i < segment.endLine() && i < lines.length; i++) {
                        if (segLineCount > 300 && i - segment.startLine() + 1 >= 200 && segment.endLine() - i > 50) {
                            segmentCode.append("    ... (").append(segLineCount - 250).append(" lines omitted)\n");
                            i = segment.endLine() - 50 - 1;
                            continue;
                        }
                        segmentCode.append(lines[i]);
                        if (i < segment.endLine() - 1) segmentCode.append("\n");
                    }

                    emitter.send(SseEmitter.event()
                            .name("segment_start")
                            .data("{\"startLine\":" + segment.startLine()
                                    + ",\"endLine\":" + segment.endLine()
                                    + ",\"title\":\"" + escapeJson(segment.title()) + "\"}"
                                    , MediaType.APPLICATION_JSON));

                    StringBuilder fullExplanation = new StringBuilder();
                    explanationService.streamSegment(
                            segmentCode.toString(),
                            segment.startLine(),
                            segment.endLine(),
                            segment.title(),
                            filePath,
                            project.getName(),
                            "source file",
                            lang
                    ).doOnNext(chunk -> {
                        fullExplanation.append(chunk);
                        try {
                            emitter.send(SseEmitter.event()
                                    .name("content")
                                    .data(chunk, MediaType.TEXT_PLAIN));
                        } catch (IOException e) {
                            throw new RuntimeException(e);
                        }
                    }).blockLast();
                    explanationList.add(fullExplanation.toString());

                    emitter.send(SseEmitter.event()
                            .name("segment_end")
                            .data("{\"startLine\":" + segment.startLine()
                                    + ",\"endLine\":" + segment.endLine() + "}"
                                    , MediaType.APPLICATION_JSON));
                }

                // Save to cache
                String explanationsJson = explanationList.stream()
                        .map(e -> "\"" + escapeJson(e) + "\"")
                        .reduce((a, b) -> a + "," + b)
                        .map(s -> "[" + s + "]")
                        .orElse("[]");
                cacheService.save(id, filePath, contentHash, segmentsJson, explanationsJson);

                emitter.complete();
            } catch (Exception e) {
                emitter.completeWithError(e);
            } finally {
                executor.shutdown();
            }
        });

        return emitter;
    }

    private SseEmitter emitCached(ExplanationCacheService.CachedExplanation cached) {
        SseEmitter emitter = new SseEmitter(60_000L);
        ExecutorService executor = Executors.newSingleThreadExecutor();
        executor.execute(() -> {
            try {
                List<CodeSegment> segments = CodeSegment.fromJson(cached.segments());
                List<String> explanations = parseStringArray(cached.explanations());

                for (int i = 0; i < segments.size(); i++) {
                    CodeSegment seg = segments.get(i);
                    emitter.send(SseEmitter.event()
                            .name("segment_start")
                            .data("{\"startLine\":" + seg.startLine()
                                    + ",\"endLine\":" + seg.endLine()
                                    + ",\"title\":\"" + escapeJson(seg.title()) + "\"}"
                                    , MediaType.APPLICATION_JSON));

                    if (i < explanations.size()) {
                        emitter.send(SseEmitter.event()
                                .name("content")
                                .data(explanations.get(i), MediaType.TEXT_PLAIN));
                    }

                    emitter.send(SseEmitter.event()
                            .name("segment_end")
                            .data("{\"startLine\":" + seg.startLine()
                                    + ",\"endLine\":" + seg.endLine() + "}"
                            , MediaType.APPLICATION_JSON));
                }

                emitter.complete();
            } catch (Exception e) {
                emitter.completeWithError(e);
            } finally {
                executor.shutdown();
            }
        });
        return emitter;
    }

    @GetMapping("/{id}/quality")
    public ResponseEntity<String> quality(@PathVariable Long id, @RequestParam String filePath, @RequestParam(defaultValue = "zh") String lang) {
        Project project = projectRepository.findById(id).orElse(null);
        if (project == null) return ResponseEntity.notFound().build();

        ProjectFile file = projectFileRepository.findByProjectAndPath(project, filePath).orElse(null);
        if (file == null) return ResponseEntity.notFound().build();

        String code = fileService.getFileContent(id, filePath);
        String contentHash = hashContent(code);

        // Check cache for quality
        var cached = cacheService.get(id, filePath, contentHash);
        if (cached.isPresent() && cached.get().quality() != null) {
            return ResponseEntity.ok(cached.get().quality());
        }

        String prompt = explanationService.buildQualityAssessmentPrompt(code, filePath, file.getLanguage(), lang);

        // Save quality to cache asynchronously
        String qualityResult = prompt;
        try {
            qualityResult = explanationService.reviewCommit(prompt);
        } catch (Exception ignored) {}

        cacheService.saveQuality(id, filePath, contentHash, qualityResult);

        return ResponseEntity.ok(qualityResult);
    }

    @GetMapping("/{id}/progress")
    public ResponseEntity<Map<String, Long>> progress(@PathVariable Long id) {
        Project project = projectRepository.findById(id).orElse(null);
        if (project == null) return ResponseEntity.notFound().build();

        List<ProjectFile> allFiles = projectFileRepository.findByProject(project);
        long total = allFiles.stream().filter(f -> Boolean.TRUE.equals(f.getAnalyzable())).count();
        long completed = allFiles.stream()
                .filter(f -> Boolean.TRUE.equals(f.getAnalyzable()) && f.getAnalysisStatus() == ProjectFile.AnalysisStatus.DONE)
                .count();
        long analyzing = allFiles.stream()
                .filter(f -> Boolean.TRUE.equals(f.getAnalyzable()) && f.getAnalysisStatus() == ProjectFile.AnalysisStatus.ANALYZING)
                .count();
        long totalFiles = allFiles.size();
        long skippedFiles = totalFiles - total;

        return ResponseEntity.ok(Map.of(
                "total", total,
                "completed", completed,
                "analyzing", analyzing,
                "totalFiles", totalFiles,
                "skippedFiles", skippedFiles
        ));
    }

    @GetMapping("/{id}/dependencies")
    public ResponseEntity<DependencyGraph> dependencies(@PathVariable Long id) {
        Project project = projectRepository.findById(id).orElse(null);
        if (project == null) return ResponseEntity.notFound().build();

        List<ProjectFile> files = projectFileRepository.findByProject(project);

        Map<String, String> fileContentMap = new java.util.LinkedHashMap<>();
        for (ProjectFile pf : files) {
            try {
                String content = fileService.getFileContent(id, pf.getPath());
                fileContentMap.put(pf.getPath(), content);
            } catch (Exception ignored) {}
        }

        List<Map<String, String>> nodes = new ArrayList<>();
        List<Map<String, String>> edges = new ArrayList<>();

        for (ProjectFile pf : files) {
            nodes.add(Map.of("id", pf.getPath(), "label", pf.getPath(),
                    "language", pf.getLanguage() != null ? pf.getLanguage() : ""));

            String content = fileContentMap.get(pf.getPath());
            if (content == null) continue;

            List<String> imports = DependencyAnalyzer.parseImports(content, pf.getLanguage());
            for (String imp : imports) {
                String resolved = DependencyAnalyzer.resolveImport(imp, pf.getLanguage(), fileContentMap, pf.getPath());
                if (resolved != null && !resolved.equals(pf.getPath())) {
                    edges.add(Map.of("source", pf.getPath(), "target", resolved));
                }
            }
        }

        return ResponseEntity.ok(new DependencyGraph(nodes, edges));
    }

    public record DependencyGraph(List<Map<String, String>> nodes, List<Map<String, String>> edges) {}

    @GetMapping("/{id}/structure")
    public ResponseEntity<Map<String, String>> structure(@PathVariable Long id, @RequestParam(defaultValue = "zh") String lang) {
        Project project = projectRepository.findById(id).orElse(null);
        if (project == null) return ResponseEntity.notFound().build();

        // Use cached structure analysis if available and language matches
        String cachedLang = project.getStructureAnalysisLang();
        if (project.getStructureAnalysis() != null && !project.getStructureAnalysis().isBlank()
                && lang.equals(cachedLang)) {
            return ResponseEntity.ok(Map.of("analysis", project.getStructureAnalysis()));
        }

        FileService.FileTreeNode tree = fileService.getFileTree(id);
        String fileTreeText = renderFileTree(tree, 0);

        String analysis = explanationService.analyzeProjectStructure(project.getName(), fileTreeText, lang);
        project.setStructureAnalysis(analysis);
        project.setStructureAnalysisLang(lang);
        project.setStructureAnalysis(analysis);
        projectRepository.save(project);

        return ResponseEntity.ok(Map.of("analysis", analysis));
    }

    @GetMapping("/{id}/ast")
    public ResponseEntity<?> getFileAst(@PathVariable Long id, @RequestParam String filePath) {
        Project project = projectRepository.findById(id).orElse(null);
        if (project == null) return ResponseEntity.notFound().build();

        ProjectFile file = projectFileRepository.findByProjectAndPath(project, filePath).orElse(null);
        if (file == null) return ResponseEntity.notFound().build();

        String code = fileService.getFileContent(id, filePath);
        List<AstNode> ast = TreeSitterAstParser.parse(code, file.getLanguage());
        return ResponseEntity.ok(ast);
    }

    private String renderFileTree(FileService.FileTreeNode node, int depth) {
        StringBuilder sb = new StringBuilder();
        String indent = "  ".repeat(depth);
        if ("directory".equals(node.type())) {
            sb.append(indent).append(node.name()).append("/\n");
            if (node.children() != null) {
                for (FileService.FileTreeNode child : node.children()) {
                    sb.append(renderFileTree(child, depth + 1));
                }
            }
        } else {
            sb.append(indent).append(node.name());
            if (node.language() != null) {
                sb.append(node.analyzable() ? " ★" : "").append(" (")
                        .append(node.lineCount() != null ? node.lineCount() + " lines, " : "")
                        .append(node.language()).append(")");
            }
            sb.append("\n");
        }
        return sb.toString();
    }

    @GetMapping("/{id}/search")
    public ResponseEntity<List<Map<String, Object>>> search(@PathVariable Long id, @RequestParam String q) {
        Project project = projectRepository.findById(id).orElse(null);
        if (project == null) return ResponseEntity.notFound().build();

        if (q == null || q.isBlank()) return ResponseEntity.ok(List.of());

        List<ProjectFile> files = projectFileRepository.findByProject(project);
        Pattern pattern;
        try {
            pattern = Pattern.compile(Pattern.quote(q), Pattern.CASE_INSENSITIVE);
        } catch (Exception e) {
            return ResponseEntity.ok(List.of());
        }

        List<Map<String, Object>> results = new ArrayList<>();
        int maxResults = 50;

        for (ProjectFile pf : files) {
            if (results.size() >= maxResults) break;
            try {
                String content = fileService.getFileContent(id, pf.getPath());
                String[] lines = content.split("\n", -1);
                for (int i = 0; i < lines.length && results.size() < maxResults; i++) {
                    if (pattern.matcher(lines[i]).find()) {
                        String context = lines[i].trim();
                        if (context.length() > 200) {
                            Matcher m = pattern.matcher(context);
                            if (m.find()) {
                                int start = Math.max(0, m.start() - 50);
                                int end = Math.min(context.length(), m.end() + 50);
                                context = (start > 0 ? "..." : "") + context.substring(start, end) + (end < context.length() ? "..." : "");
                            }
                        }
                        results.add(Map.of("path", (Object) pf.getPath(), "line", i + 1, "text", context));
                    }
                }
            } catch (Exception ignored) {}
        }

        return ResponseEntity.ok(results);
    }

    @GetMapping("/{id}/export")
    public ResponseEntity<byte[]> exportReport(@PathVariable Long id) {
        Project project = projectRepository.findById(id).orElse(null);
        if (project == null) return ResponseEntity.notFound().build();

        List<ProjectFile> files = projectFileRepository.findByProject(project);
        FileService.FileTreeNode tree = fileService.getFileTree(id);
        String fileTreeText = renderFileTree(tree, 0);

        StringBuilder md = new StringBuilder();
        md.append("# ").append(project.getName()).append(" — Code Analysis Report\n\n");
        md.append("## Project Structure\n\n```\n").append(fileTreeText).append("```\n\n");
        md.append("## Files\n\n");

        for (ProjectFile pf : files) {
            md.append("### ").append(pf.getPath()).append("\n\n");
            if (pf.getLanguage() != null) {
                md.append("_Language: ").append(pf.getLanguage());
                if (pf.getLineCount() != null) md.append(", ").append(pf.getLineCount()).append(" lines");
                md.append("_\n\n");
            }
            try {
                String content = fileService.getFileContent(id, pf.getPath());
                String ext = pf.getPath().contains(".") ? pf.getPath().substring(pf.getPath().lastIndexOf('.') + 1) : "";
                md.append("```").append(ext).append("\n").append(content).append("\n```\n\n");
            } catch (Exception e) {
                md.append("_Content unavailable_\n\n");
            }
        }

        byte[] bytes = md.toString().getBytes(StandardCharsets.UTF_8);
        String filename = project.getName().replaceAll("[^a-zA-Z0-9._-]", "_") + "_report.md";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.valueOf("text/markdown"))
                .contentLength(bytes.length)
                .body(bytes);
    }

    private String hashContent(String content) {
        try {
            var digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(content.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(hash);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"")
                .replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t");
    }

    private List<String> parseStringArray(String json) {
        List<String> result = new ArrayList<>();
        if (json == null || json.length() < 2) return result;
        String inner = json.substring(1, json.length() - 1);
        int i = 0;
        while (i < inner.length()) {
            if (inner.charAt(i) == '"') {
                int end = inner.indexOf('"', i + 1);
                while (end > 0 && inner.charAt(end - 1) == '\\') {
                    end = inner.indexOf('"', end + 1);
                }
                if (end < 0) break;
                String s = inner.substring(i + 1, end)
                        .replace("\\\"", "\"")
                        .replace("\\\\", "\\")
                        .replace("\\n", "\n")
                        .replace("\\r", "\r")
                        .replace("\\t", "\t");
                result.add(s);
                i = end + 1;
                while (i < inner.length() && inner.charAt(i) == ',') i++;
            } else {
                i++;
            }
        }
        return result;
    }
}
