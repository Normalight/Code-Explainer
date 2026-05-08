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

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ExplanationController.class)
class ProgressControllerTest {

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
    void progress_returnsStats() throws Exception {
        Project project = new Project();
        project.setId(1L);

        when(projectRepository.findById(1L)).thenReturn(java.util.Optional.of(project));
        when(projectFileRepository.countByProject(project)).thenReturn(10L);
        when(projectFileRepository.countByProjectAndAnalysisStatus(project, ProjectFile.AnalysisStatus.DONE)).thenReturn(5L);
        when(projectFileRepository.countByProjectAndAnalysisStatus(project, ProjectFile.AnalysisStatus.ANALYZING)).thenReturn(2L);

        mockMvc.perform(get("/api/projects/1/progress"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(10))
                .andExpect(jsonPath("$.completed").value(5))
                .andExpect(jsonPath("$.analyzing").value(2));
    }

    @Test
    void progress_projectNotFound_returns404() throws Exception {
        when(projectRepository.findById(99L)).thenReturn(java.util.Optional.empty());

        mockMvc.perform(get("/api/projects/99/progress"))
                .andExpect(status().isNotFound());
    }
}
