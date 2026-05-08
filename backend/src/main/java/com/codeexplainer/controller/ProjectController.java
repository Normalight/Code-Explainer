package com.codeexplainer.controller;

import com.codeexplainer.model.Project;
import com.codeexplainer.repository.ProjectRepository;
import com.codeexplainer.service.AutoAnalysisService;
import com.codeexplainer.service.FileService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/projects")
@RequiredArgsConstructor
public class ProjectController {

    private final FileService fileService;
    private final ProjectRepository projectRepository;
    private final AutoAnalysisService autoAnalysisService;

    @GetMapping
    public ResponseEntity<List<Project>> listProjects() {
        return ResponseEntity.ok(projectRepository.findAllByOrderByUploadTimeDesc());
    }

    @PostMapping("/upload")
    public ResponseEntity<Project> uploadZip(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "uploadDir", defaultValue = "./uploads") String uploadDir
    ) throws IOException {
        Project project = fileService.uploadZip(file, uploadDir);
        autoAnalysisService.startAnalysis(project.getId());
        return ResponseEntity.ok(project);
    }

    @PostMapping("/import-github")
    public ResponseEntity<?> importGitHub(@RequestBody GitHubImportRequest req) {
        if (req.url == null || req.url.isBlank()) {
            return ResponseEntity.badRequest().body("url is required");
        }
        try {
            Project project = fileService.importFromGitHub(req.url, req.uploadDir != null ? req.uploadDir : "./uploads");
            autoAnalysisService.startAnalysis(project.getId());
            return ResponseEntity.ok(project);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    public record GitHubImportRequest(String url, String uploadDir) {}

    @GetMapping("/{id}/tree")
    public ResponseEntity<FileService.FileTreeNode> getFileTree(@PathVariable Long id) {
        return ResponseEntity.ok(fileService.getFileTree(id));
    }

    @GetMapping("/{id}/files/{*filePath}")
    public ResponseEntity<String> getFileContent(
            @PathVariable Long id,
            @PathVariable String filePath
    ) {
        return ResponseEntity.ok(fileService.getFileContent(id, filePath));
    }
}
