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

import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ExplanationController.class)
class ExplanationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ProjectRepository projectRepository;

    @MockBean
    private ProjectFileRepository projectFileRepository;

    @MockBean
    private ExplanationService explanationService;

    @MockBean
    private FileService fileService;

    @MockBean
    private ExplanationCacheRepository explanationCacheRepository;

    @MockBean
    private ExplanationCacheService explanationCacheService;

    @Test
    void explain_projectNotFound_returns404() throws Exception {
        when(projectRepository.findById(99L)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/projects/99/explain").param("filePath", "main.py"))
                .andExpect(status().isNotFound());
    }

    @Test
    void explain_fileNotFound_returns404() throws Exception {
        Project project = new Project();
        project.setId(1L);

        when(projectRepository.findById(1L)).thenReturn(Optional.of(project));
        when(projectFileRepository.findByProjectAndPath(project, "missing.py")).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/projects/1/explain").param("filePath", "missing.py"))
                .andExpect(status().isNotFound());
    }

    @Test
    void quality_projectNotFound_returns404() throws Exception {
        when(projectRepository.findById(99L)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/projects/99/quality").param("filePath", "main.py"))
                .andExpect(status().isNotFound());
    }

    @Test
    void quality_fileNotFound_returns404() throws Exception {
        Project project = new Project();
        project.setId(1L);

        when(projectRepository.findById(1L)).thenReturn(Optional.of(project));
        when(projectFileRepository.findByProjectAndPath(project, "missing.py")).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/projects/1/quality").param("filePath", "missing.py"))
                .andExpect(status().isNotFound());
    }

    @Test
    void quality_returnsOkWhenFileExists() throws Exception {
        Project project = new Project();
        project.setId(1L);

        ProjectFile file = new ProjectFile();
        file.setId(1L);
        file.setPath("main.py");
        file.setLanguage("Python");
        file.setProject(project);

        when(projectRepository.findById(1L)).thenReturn(Optional.of(project));
        when(projectFileRepository.findByProjectAndPath(project, "main.py")).thenReturn(Optional.of(file));
        when(fileService.getFileContent(1L, "main.py")).thenReturn("x = 1");
        when(explanationCacheService.get(eq(1L), eq("main.py"), any())).thenReturn(Optional.empty());
        when(explanationService.buildQualityAssessmentPrompt("x = 1", "main.py", "Python"))
                .thenReturn("{\"grade\":\"A\"}");
        when(explanationService.reviewCommit(any())).thenReturn("{\"grade\":\"A\"}");

        mockMvc.perform(get("/api/projects/1/quality").param("filePath", "main.py"))
                .andExpect(status().isOk());
    }
}
