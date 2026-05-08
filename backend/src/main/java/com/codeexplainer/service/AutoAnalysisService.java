package com.codeexplainer.service;

import com.codeexplainer.model.ExplanationCache;
import com.codeexplainer.model.Project;
import com.codeexplainer.model.ProjectFile;
import com.codeexplainer.repository.ExplanationCacheRepository;
import com.codeexplainer.repository.ProjectFileRepository;
import com.codeexplainer.repository.ProjectRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.ContextRefreshedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

@Service
@RequiredArgsConstructor
@Slf4j
public class AutoAnalysisService {

    private final ProjectFileRepository fileRepository;
    private final ProjectRepository projectRepository;
    private final ExplanationCacheRepository cacheRepository;
    private final ExplanationService explanationService;
    private final FileService fileService;

    private final Map<Long, AtomicBoolean> runningProjects = new ConcurrentHashMap<>();

    @EventListener(ContextRefreshedEvent.class)
    public void onResume() {
        // Resume pending/analyzing files on startup
        List<Project> projects = projectRepository.findAll();
        for (Project project : projects) {
            List<ProjectFile> pending = fileRepository.findByProject(project).stream()
                    .filter(f -> Boolean.TRUE.equals(f.getAnalyzable())
                            && f.getAnalysisStatus() != ProjectFile.AnalysisStatus.DONE)
                    .toList();
            if (!pending.isEmpty()) {
                log.info("Resuming analysis for project {} ({} files remaining)", project.getId(), pending.size());
                startAnalysis(project.getId());
            }
        }
    }

    public void startAnalysis(Long projectId) {
        AtomicBoolean running = new AtomicBoolean(true);
        runningProjects.put(projectId, running);

        CompletableFuture.runAsync(() -> {
            try {
                analyzeLoop(projectId, running);
            } finally {
                runningProjects.remove(projectId);
            }
        });
    }

    public void stopAnalysis(Long projectId) {
        AtomicBoolean running = runningProjects.get(projectId);
        if (running != null) running.set(false);
    }

    private void analyzeLoop(Long projectId, AtomicBoolean running) {
        Project project = projectRepository.findById(projectId).orElse(null);
        if (project == null) return;

        while (running.get()) {
            List<ProjectFile> pending = fileRepository.findByProject(project).stream()
                    .filter(f -> Boolean.TRUE.equals(f.getAnalyzable())
                            && f.getAnalysisStatus() == ProjectFile.AnalysisStatus.PENDING)
                    .toList();

            if (pending.isEmpty()) {
                log.info("Analysis complete for project {}", projectId);
                return;
            }

            // Also check if already cached (e.g. from previous run)
            for (ProjectFile file : pending) {
                if (!running.get()) return;

                try {
                    String content = fileService.getFileContent(projectId, file.getPath());
                    String hash = hashContent(content);

                    var cached = cacheRepository.findByProjectIdAndPathAndContentHash(projectId, file.getPath(), hash);
                    if (cached.isPresent() && cached.get().getSegments() != null) {
                        file.setAnalysisStatus(ProjectFile.AnalysisStatus.DONE);
                        fileRepository.save(file);
                        continue;
                    }

                    // Mark as analyzing
                    file.setAnalysisStatus(ProjectFile.AnalysisStatus.ANALYZING);
                    fileRepository.save(file);

                    // Segment and explain
                    List<CodeSegment> segments = explanationService.segmentCode(content, file.getPath(), file.getLanguage(), "zh");
                    String segmentsJson = CodeSegment.toJsonArray(segments);
                    List<String> explanationList = new java.util.ArrayList<>();

                    for (CodeSegment segment : segments) {
                        String[] lines = content.split("\n", -1);
                        StringBuilder segmentCode = new StringBuilder();
                        for (int i = segment.startLine() - 1; i < segment.endLine() && i < lines.length; i++) {
                            segmentCode.append(lines[i]);
                            if (i < segment.endLine() - 1) segmentCode.append("\n");
                        }

                        String explanation = explanationService.explainSegment(
                                segmentCode.toString(), segment.startLine(), segment.endLine(),
                                segment.title(), file.getPath(), project.getName(), "source file", "zh");
                        explanationList.add(explanation);
                    }

                    String explanationsJson = explanationList.stream()
                            .map(e -> "\"" + escapeJson(e) + "\"")
                            .reduce((a, b) -> a + "," + b)
                            .map(s -> "[" + s + "]")
                            .orElse("[]");

                    // Save to cache
                    ExplanationCache cache = cacheRepository
                            .findByProjectIdAndPathAndContentHash(projectId, file.getPath(), hash)
                            .orElseGet(ExplanationCache::new);
                    cache.setProjectId(projectId);
                    cache.setPath(file.getPath());
                    cache.setContentHash(hash);
                    cache.setSegments(segmentsJson);
                    cache.setSegmentExplanations(explanationsJson);
                    cacheRepository.save(cache);

                    file.setAnalysisStatus(ProjectFile.AnalysisStatus.DONE);
                    fileRepository.save(file);

                    log.debug("Analyzed {} in project {}", file.getPath(), projectId);
                } catch (Exception e) {
                    log.warn("Failed to analyze {} in project {}: {}", file.getPath(), projectId, e.getMessage());
                    // Reset to pending so it can be retried
                    file.setAnalysisStatus(ProjectFile.AnalysisStatus.PENDING);
                    fileRepository.save(file);
                    return;
                }
            }
        }
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
}
