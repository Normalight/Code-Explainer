package com.codeexplainer.repository;

import com.codeexplainer.model.ProjectFile;
import com.codeexplainer.model.Project;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProjectFileRepository extends JpaRepository<ProjectFile, Long> {
    List<ProjectFile> findByProject(Project project);
    Optional<ProjectFile> findByProjectAndPath(Project project, String path);
    long countByProjectAndAnalysisStatus(Project project, ProjectFile.AnalysisStatus status);
    long countByProject(Project project);
}
