package com.codeexplainer.service;

import com.codeexplainer.model.ExplanationCache;
import com.codeexplainer.repository.ExplanationCacheRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class ExplanationCacheService {

    private final ExplanationCacheRepository cacheRepository;

    public Optional<CachedExplanation> get(Long projectId, String path, String contentHash) {
        return cacheRepository.findByProjectIdAndPathAndContentHash(projectId, path, contentHash)
                .map(c -> new CachedExplanation(c.getSegments(), c.getSegmentExplanations(), c.getQualityAssessment()));
    }

    public void save(Long projectId, String path, String contentHash,
                     String segmentsJson, String explanationsJson) {
        ExplanationCache cache = cacheRepository
                .findByProjectIdAndPathAndContentHash(projectId, path, contentHash)
                .orElseGet(ExplanationCache::new);

        cache.setProjectId(projectId);
        cache.setPath(path);
        cache.setContentHash(contentHash);
        cache.setSegments(segmentsJson);
        cache.setSegmentExplanations(explanationsJson);

        cacheRepository.save(cache);
    }

    public void saveQuality(Long projectId, String path, String contentHash, String qualityJson) {
        ExplanationCache cache = cacheRepository
                .findByProjectIdAndPathAndContentHash(projectId, path, contentHash)
                .orElseGet(() -> {
                    ExplanationCache c = new ExplanationCache();
                    c.setProjectId(projectId);
                    c.setPath(path);
                    c.setContentHash(contentHash);
                    return c;
                });

        cache.setQualityAssessment(qualityJson);
        cacheRepository.save(cache);
    }

    public record CachedExplanation(String segments, String explanations, String quality) {}
}
