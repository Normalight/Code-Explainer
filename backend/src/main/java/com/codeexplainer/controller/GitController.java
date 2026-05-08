package com.codeexplainer.controller;

import com.codeexplainer.model.Project;
import com.codeexplainer.repository.ProjectRepository;
import com.codeexplainer.service.GitService;
import com.codeexplainer.service.GitService.CommitInfo;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/projects")
@RequiredArgsConstructor
public class GitController {

    private final ProjectRepository projectRepository;
    private final GitService gitService;

    @GetMapping("/{id}/commits")
    public ResponseEntity<?> listCommits(@PathVariable Long id,
                                          @RequestParam(defaultValue = "50") int limit) {
        Project project = projectRepository.findById(id).orElse(null);
        if (project == null) return ResponseEntity.notFound().build();

        try {
            List<CommitInfo> commits = gitService.listCommits(project.getZipPath(), limit);
            return ResponseEntity.ok(commits);
        } catch (Exception e) {
            return ResponseEntity.ok(List.of());
        }
    }

    @GetMapping("/{id}/commits/{hash}/diff")
    public ResponseEntity<?> getDiff(@PathVariable Long id, @PathVariable String hash) {
        Project project = projectRepository.findById(id).orElse(null);
        if (project == null) return ResponseEntity.notFound().build();

        try {
            String diff = gitService.getDiff(project.getZipPath(), hash);
            return ResponseEntity.ok(Map.of("diff", diff));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("diff", "Failed to get diff: " + e.getMessage()));
        }
    }

    @GetMapping("/{id}/commits/{hash}/review")
    public ResponseEntity<?> reviewCommit(@PathVariable Long id, @PathVariable String hash) {
        Project project = projectRepository.findById(id).orElse(null);
        if (project == null) return ResponseEntity.notFound().build();

        try {
            String review = gitService.reviewCommit(project.getZipPath(), hash);
            return ResponseEntity.ok(Map.of("review", review));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("review", "Review failed: " + e.getMessage()));
        }
    }
}
