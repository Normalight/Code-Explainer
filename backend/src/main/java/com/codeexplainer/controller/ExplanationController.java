package com.codeexplainer.controller;

import com.codeexplainer.model.Project;
import com.codeexplainer.model.ProjectFile;
import com.codeexplainer.repository.ProjectFileRepository;
import com.codeexplainer.repository.ProjectRepository;
import com.codeexplainer.service.CodeSegment;
import com.codeexplainer.service.ExplanationService;
import com.codeexplainer.service.FileService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@RestController
@RequestMapping("/api/projects")
@RequiredArgsConstructor
public class ExplanationController {

    private final ProjectRepository projectRepository;
    private final ProjectFileRepository projectFileRepository;
    private final FileService fileService;
    private final ExplanationService explanationService;

    @GetMapping(value = "/{id}/explain", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Object explain(@PathVariable Long id, @RequestParam String filePath) {
        Project project = projectRepository.findById(id).orElse(null);
        if (project == null) {
            return ResponseEntity.notFound().build();
        }

        ProjectFile file = projectFileRepository.findByProjectAndPath(project, filePath).orElse(null);
        if (file == null) {
            return ResponseEntity.notFound().build();
        }

        String code = fileService.getFileContent(id, filePath);

        SseEmitter emitter = new SseEmitter(300_000L);
        ExecutorService executor = Executors.newSingleThreadExecutor();
        executor.execute(() -> {
            try {
                List<CodeSegment> segments = explanationService.segmentCode(code, filePath, file.getLanguage());

                for (CodeSegment segment : segments) {
                    String[] lines = code.split("\n", -1);
                    StringBuilder segmentCode = new StringBuilder();
                    for (int i = segment.startLine() - 1; i < segment.endLine() && i < lines.length; i++) {
                        segmentCode.append(lines[i]);
                        if (i < segment.endLine() - 1) segmentCode.append("\n");
                    }

                    emitter.send(SseEmitter.event()
                            .name("segment_start")
                            .data("{\"startLine\":" + segment.startLine()
                                    + ",\"endLine\":" + segment.endLine()
                                    + ",\"title\":\"" + escapeJson(segment.title()) + "\"}"
                                    , MediaType.APPLICATION_JSON));

                    String explanation = explanationService.explainSegment(
                            segmentCode.toString(),
                            segment.startLine(),
                            segment.endLine(),
                            segment.title(),
                            filePath,
                            project.getName(),
                            "source file"
                    );

                    emitter.send(SseEmitter.event()
                            .name("content")
                            .data(explanation, MediaType.TEXT_PLAIN));

                    emitter.send(SseEmitter.event()
                            .name("segment_end")
                            .data("{\"startLine\":" + segment.startLine()
                                    + ",\"endLine\":" + segment.endLine() + "}"
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
    public ResponseEntity<String> quality(@PathVariable Long id, @RequestParam String filePath) {
        Project project = projectRepository.findById(id)
                .orElse(null);
        if (project == null) {
            return ResponseEntity.notFound().build();
        }

        ProjectFile file = projectFileRepository.findByProjectAndPath(project, filePath)
                .orElse(null);
        if (file == null) {
            return ResponseEntity.notFound().build();
        }

        String code = fileService.getFileContent(id, filePath);
        String prompt = explanationService.buildQualityAssessmentPrompt(code, filePath, file.getLanguage());

        return ResponseEntity.ok(prompt);
    }

    @GetMapping("/{id}/progress")
    public ResponseEntity<Map<String, Long>> progress(@PathVariable Long id) {
        Project project = projectRepository.findById(id).orElse(null);
        if (project == null) {
            return ResponseEntity.notFound().build();
        }

        long total = projectFileRepository.countByProject(project);
        long completed = projectFileRepository.countByProjectAndAnalysisStatus(project, ProjectFile.AnalysisStatus.DONE);
        long analyzing = projectFileRepository.countByProjectAndAnalysisStatus(project, ProjectFile.AnalysisStatus.ANALYZING);

        return ResponseEntity.ok(Map.of(
                "total", total,
                "completed", completed,
                "analyzing", analyzing
        ));
    }

    @GetMapping("/{id}/structure")
    public ResponseEntity<Map<String, String>> structure(@PathVariable Long id) {
        Project project = projectRepository.findById(id).orElse(null);
        if (project == null) {
            return ResponseEntity.notFound().build();
        }

        FileService.FileTreeNode tree = fileService.getFileTree(id);
        String fileTreeText = renderFileTree(tree, 0);

        String analysis = explanationService.analyzeProjectStructure(project.getName(), fileTreeText);

        return ResponseEntity.ok(Map.of("analysis", analysis));
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
                sb.append(" (").append(node.lineCount() != null ? node.lineCount() + " lines, " : "")
                        .append(node.language()).append(")");
            }
            sb.append("\n");
        }
        return sb.toString();
    }

    private String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
