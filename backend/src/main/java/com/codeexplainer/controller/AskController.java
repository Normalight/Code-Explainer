package com.codeexplainer.controller;

import com.codeexplainer.model.Project;
import com.codeexplainer.model.ProjectFile;
import com.codeexplainer.repository.ProjectFileRepository;
import com.codeexplainer.repository.ProjectRepository;
import com.codeexplainer.service.AskService;
import com.codeexplainer.service.FileService;
import com.codeexplainer.service.RagService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@RestController
@RequestMapping("/api/projects")
@RequiredArgsConstructor
public class AskController {

    private final ProjectRepository projectRepository;
    private final ProjectFileRepository projectFileRepository;
    private final FileService fileService;
    private final AskService askService;
    private final RagService ragService;

    @GetMapping(value = "/{id}/ask", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Object ask(@PathVariable Long id,
                       @RequestParam String filePath,
                       @RequestParam int startLine,
                       @RequestParam int endLine,
                       @RequestParam String question) {
        Project project = projectRepository.findById(id).orElse(null);
        if (project == null) {
            return ResponseEntity.notFound().build();
        }

        ProjectFile file = projectFileRepository.findByProjectAndPath(project, filePath).orElse(null);
        if (file == null) {
            return ResponseEntity.notFound().build();
        }

        String fullCode = fileService.getFileContent(id, filePath);
        String[] lines = fullCode.split("\n", -1);
        int from = Math.max(0, startLine - 1);
        int to = Math.min(lines.length, endLine);
        StringBuilder selectedCode = new StringBuilder();
        for (int i = from; i < to; i++) {
            selectedCode.append(lines[i]);
            if (i < to - 1) selectedCode.append("\n");
        }

        SseEmitter emitter = new SseEmitter(120_000L);
        ExecutorService executor = Executors.newSingleThreadExecutor();
        executor.execute(() -> {
            try {
                String ragContext = ragService.searchAndBuildContext(id, question, 3);
                String answer = askService.ask(
                        selectedCode.toString(), startLine, endLine,
                        filePath, question, project.getName(), fullCode, ragContext
                );

                emitter.send(SseEmitter.event()
                        .name("content")
                        .data(answer, MediaType.TEXT_PLAIN));

                emitter.complete();
            } catch (Exception e) {
                emitter.completeWithError(e);
            } finally {
                executor.shutdown();
            }
        });

        return emitter;
    }
}
