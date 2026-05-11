package com.codeexplainer.repository;

import com.codeexplainer.model.ExplanationCache;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ExplanationCacheRepository extends JpaRepository<ExplanationCache, Long> {
    Optional<ExplanationCache> findByProjectIdAndPathAndContentHash(Long projectId, String path, String contentHash);
    List<ExplanationCache> findByProjectId(Long projectId);
}
