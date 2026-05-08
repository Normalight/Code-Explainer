package com.codeexplainer.controller;

import com.codeexplainer.model.Project;
import com.codeexplainer.repository.ProjectFileRepository;
import com.codeexplainer.repository.ProjectRepository;
import com.codeexplainer.service.ExplanationService;
import com.codeexplainer.service.FileService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ExplanationController.class)
class StructureControllerTest {

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

    @Test
    void structure_projectNotFound_returns404() throws Exception {
        when(projectRepository.findById(99L)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/projects/99/structure"))
                .andExpect(status().isNotFound());
    }

    @Test
    void structure_returnsAnalysis() throws Exception {
        Project project = new Project();
        project.setId(1L);
        project.setName("test-project");

        when(projectRepository.findById(1L)).thenReturn(Optional.of(project));
        when(fileService.getFileTree(1L)).thenReturn(
                new FileService.FileTreeNode("src", "directory", null, null, java.util.List.of(
                        new FileService.FileTreeNode("main.py", "file", "Python", 50, java.util.List.of())
                ))
        );
        when(explanationService.analyzeProjectStructure(eq("test-project"), anyString()))
                .thenReturn("{\"projectType\":\"Flask web app\"}");

        mockMvc.perform(get("/api/projects/1/structure"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.analysis").value("{\"projectType\":\"Flask web app\"}"));
    }
}
