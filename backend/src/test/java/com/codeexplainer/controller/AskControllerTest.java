package com.codeexplainer.controller;

import com.codeexplainer.model.Project;
import com.codeexplainer.model.ProjectFile;
import com.codeexplainer.repository.ProjectFileRepository;
import com.codeexplainer.repository.ProjectRepository;
import com.codeexplainer.service.AskService;
import com.codeexplainer.service.ExplanationService;
import com.codeexplainer.service.FileService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AskController.class)
class AskControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean private ProjectRepository projectRepository;
    @MockBean private ProjectFileRepository projectFileRepository;
    @MockBean private AskService askService;
    @MockBean private FileService fileService;
    @MockBean private ExplanationService explanationService;

    @Test
    void ask_projectNotFound_returns404() throws Exception {
        when(projectRepository.findById(99L)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/projects/99/ask")
                        .param("filePath", "main.py")
                        .param("startLine", "1")
                        .param("endLine", "5")
                        .param("question", "what?"))
                .andExpect(status().isNotFound());
    }

    @Test
    void ask_fileNotFound_returns404() throws Exception {
        Project project = new Project();
        project.setId(1L);

        when(projectRepository.findById(1L)).thenReturn(Optional.of(project));
        when(projectFileRepository.findByProjectAndPath(project, "missing.py")).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/projects/1/ask")
                        .param("filePath", "missing.py")
                        .param("startLine", "1")
                        .param("endLine", "5")
                        .param("question", "what?"))
                .andExpect(status().isNotFound());
    }
}
