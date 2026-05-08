package com.codeexplainer.controller;

import com.codeexplainer.model.Project;
import com.codeexplainer.service.FileService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@RestController
@RequestMapping("/api/projects")
@RequiredArgsConstructor
public class ProjectController {

    private final FileService fileService;

    @PostMapping("/upload")
    public ResponseEntity<Project> uploadZip(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "uploadDir", defaultValue = "./uploads") String uploadDir
    ) throws IOException {
        Project project = fileService.uploadZip(file, uploadDir);
        return ResponseEntity.ok(project);
    }

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
