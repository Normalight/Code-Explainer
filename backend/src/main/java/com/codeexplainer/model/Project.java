package com.codeexplainer.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "projects")
public class Project {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private LocalDateTime uploadTime;

    @Column(nullable = false)
    private String zipPath;

    private String overallGrade;
    private Integer totalIssuesCritical = 0;
    private Integer totalIssuesWarning = 0;
    private Integer totalIssuesSuggestion = 0;
}
