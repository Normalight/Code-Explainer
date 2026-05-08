package com.codeexplainer.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Entity
@Table(name = "files")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProjectFile {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @Column(nullable = false)
    private String path;

    @Column(nullable = false)
    private String contentHash;

    private String language;
    private Integer lineCount;

    @Enumerated(EnumType.STRING)
    private AnalysisStatus analysisStatus = AnalysisStatus.PENDING;

    @Column(nullable = false)
    private Boolean indexed = false;

    public enum AnalysisStatus {
        PENDING, ANALYZING, DONE
    }
}
