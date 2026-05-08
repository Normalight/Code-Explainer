package com.codeexplainer.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Entity
@Table(name = "explanation_cache", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"project_id", "path", "content_hash"})
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ExplanationCache {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "project_id", nullable = false)
    private Long projectId;

    @Column(nullable = false)
    private String path;

    @Column(name = "content_hash", nullable = false)
    private String contentHash;

    @Column(columnDefinition = "TEXT")
    private String segments;

    @Column(name = "segment_explanations", columnDefinition = "LONGTEXT")
    private String segmentExplanations;

    @Column(name = "quality_assessment", columnDefinition = "TEXT")
    private String qualityAssessment;
}
