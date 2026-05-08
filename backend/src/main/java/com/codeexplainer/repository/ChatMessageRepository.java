package com.codeexplainer.repository;

import com.codeexplainer.model.ChatMessageEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ChatMessageRepository extends JpaRepository<ChatMessageEntity, Long> {
    List<ChatMessageEntity> findByProjectIdAndSessionIdOrderByTimestampAsc(Long projectId, String sessionId);
    List<ChatMessageEntity> findByProjectIdOrderByTimestampDesc(Long projectId);
    void deleteByProjectIdAndSessionId(Long projectId, String sessionId);
}
