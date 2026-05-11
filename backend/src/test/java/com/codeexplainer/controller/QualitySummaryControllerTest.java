package com.codeexplainer.controller;

import com.codeexplainer.model.Project;
import com.codeexplainer.model.ProjectFile;
import com.codeexplainer.repository.ExplanationCacheRepository;
import com.codeexplainer.repository.ProjectFileRepository;
import com.codeexplainer.repository.ProjectRepository;
import com.codeexplainer.service.ExplanationCacheService;
import com.codeexplainer.service.ExplanationService;
import com.codeexplainer.service.FileService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ExplanationController.class)
class QualitySummaryControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ProjectRepository projectRepository;

    @MockBean
    private ProjectFileRepository projectFileRepository;

    @MockBean
    private ExplanationCacheRepository explanationCacheRepository;

    @MockBean
    private FileService fileService;

    @MockBean
    private ExplanationService explanationService;

    @MockBean
    private ExplanationCacheService cacheService;

    @Test
    void qualitySummary_projectNotFound_returns404() throws Exception {
        when(projectRepository.findById(99L)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/projects/99/quality-summary"))
                .andExpect(status().isNotFound());
    }

    @Test
    void returnsProjectLevelQualitySummary() throws Exception {
        Project project = new Project();
        project.setId(1L);

        ProjectFile file1 = new ProjectFile();
        file1.setId(1L);
        file1.setPath("main.py");
        file1.setAnalyzable(true);
        file1.setProject(project);

        when(projectRepository.findById(1L)).thenReturn(Optional.of(project));
        when(projectFileRepository.findByProject(project)).thenReturn(List.of(file1));

        String qualityJson = """
                {
                  "grade": "B",
                  "scores": { "readability": 4, "complexity": 3, "convention": 4, "security": 5 },
                  "summary": "Decent code",
                  "issues": [
                    { "severity": "critical", "lineStart": 1, "lineEnd": 5, "title": "Hardcoded secret", "description": "Fix it" },
                    { "severity": "warning", "lineStart": 10, "lineEnd": 12, "title": "Long function", "description": "Refactor" }
                  ]
                }
                """;

        when(cacheService.getAllQualityAssessments(1L))
                .thenReturn(Map.of("main.py", qualityJson));

        mockMvc.perform(get("/api/projects/1/quality-summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.overallGrade").value("B"))
                .andExpect(jsonPath("$.fileCountAnalyzed").value(1))
                .andExpect(jsonPath("$.criticalCount").value(1))
                .andExpect(jsonPath("$.warningCount").value(1))
                .andExpect(jsonPath("$.suggestionCount").value(0))
                .andExpect(jsonPath("$.averageScores.readability").value(4.0))
                .andExpect(jsonPath("$.averageScores.complexity").value(3.0))
                .andExpect(jsonPath("$.topIssues[0].severity").value("critical"))
                .andExpect(jsonPath("$.topIssues[0].title").value("Hardcoded secret"));
    }

    @Test
    void qualitySummary_noQualityData_returnsDefaults() throws Exception {
        Project project = new Project();
        project.setId(2L);

        ProjectFile file1 = new ProjectFile();
        file1.setId(1L);
        file1.setPath("main.py");
        file1.setAnalyzable(true);
        file1.setProject(project);

        when(projectRepository.findById(2L)).thenReturn(Optional.of(project));
        when(projectFileRepository.findByProject(project)).thenReturn(List.of(file1));
        when(cacheService.getAllQualityAssessments(2L)).thenReturn(Map.of());

        mockMvc.perform(get("/api/projects/2/quality-summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.overallGrade").value("N/A"))
                .andExpect(jsonPath("$.fileCountAnalyzed").value(0))
                .andExpect(jsonPath("$.criticalCount").value(0));
    }
}
