package com.codeexplainer.controller;

import com.codeexplainer.model.ChatMessageEntity;
import com.codeexplainer.model.Project;
import com.codeexplainer.repository.ChatMessageRepository;
import com.codeexplainer.repository.ProjectRepository;
import com.codeexplainer.service.ChatMessage;
import com.codeexplainer.service.ChatService;
import com.codeexplainer.service.FileService;
import com.codeexplainer.service.RagService;
import com.codeexplainer.service.SummaryCompressionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@RestController
@RequestMapping("/api/projects")
@RequiredArgsConstructor
public class ChatController {

    private static final int SLIDING_WINDOW = 8;
    private static final int COMPRESS_THRESHOLD = 12;

    private final ProjectRepository projectRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final FileService fileService;
    private final ChatService chatService;
    private final RagService ragService;
    private final SummaryCompressionService summaryService;

    @PostMapping(value = "/{id}/chat", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Object chat(@PathVariable Long id, @RequestBody ChatRequest req) {
        Project project = projectRepository.findById(id).orElse(null);
        if (project == null) {
            return ResponseEntity.notFound().build();
        }

        String sessionId = req.sessionId != null ? req.sessionId : UUID.randomUUID().toString();
        final String sid = sessionId;
        final String message = req.message;

        // Save user message
        ChatMessageEntity userMsg = new ChatMessageEntity();
        userMsg.setProjectId(id);
        userMsg.setSessionId(sid);
        userMsg.setRole("user");
        userMsg.setContent(req.message);
        userMsg.setTimestamp(LocalDateTime.now());
        chatMessageRepository.save(userMsg);

        // Load all history
        List<ChatMessageEntity> allMessages = chatMessageRepository
                .findByProjectIdAndSessionIdOrderByTimestampAsc(id, sid);

        // Compress old messages if beyond threshold
        String compressedSummary = "";
        int startIndex = 0;
        if (allMessages.size() - 1 > COMPRESS_THRESHOLD) {
            int compressUpTo = allMessages.size() - 1 - SLIDING_WINDOW;
            List<ChatMessage> oldMessages = allMessages.subList(0, compressUpTo)
                    .stream()
                    .map(m -> new ChatMessage(m.getRole(), m.getContent()))
                    .toList();
            compressedSummary = summaryService.compress(oldMessages);
            startIndex = compressUpTo;
        }

        // Build sliding window history
        int windowStart = Math.max(startIndex, allMessages.size() - 1 - SLIDING_WINDOW);
        List<ChatMessage> history = allMessages.subList(windowStart, allMessages.size() - 1)
                .stream()
                .map(m -> new ChatMessage(m.getRole(), m.getContent()))
                .toList();

        // Collect context
        String structureCtx = "";
        try {
            FileService.FileTreeNode tree = fileService.getFileTree(id);
            structureCtx = renderTree(tree, 0);
        } catch (Exception ignored) {}

        final String structureContext = structureCtx;
        final String summary = compressedSummary;

        String ragContext = ragService.searchAndBuildContext(id, message, 5);

        SseEmitter emitter = new SseEmitter(120_000L);
        ExecutorService executor = Executors.newSingleThreadExecutor();
        executor.execute(() -> {
            try {
                String contextWithSummary = ragContext;
                if (!summary.isEmpty()) {
                    contextWithSummary = "## 对话摘要\n" + summary + "\n\n" + ragContext;
                }
                String answer = chatService.chat(message, structureContext, contextWithSummary, history);

                emitter.send(SseEmitter.event()
                        .name("content")
                        .data(answer, MediaType.TEXT_PLAIN));

                // Save assistant message
                ChatMessageEntity assistantMsg = new ChatMessageEntity();
                assistantMsg.setProjectId(id);
                assistantMsg.setSessionId(sid);
                assistantMsg.setRole("assistant");
                assistantMsg.setContent(answer);
                assistantMsg.setTimestamp(LocalDateTime.now());
                chatMessageRepository.save(assistantMsg);

                emitter.send(SseEmitter.event()
                        .name("done")
                        .data("{\"sessionId\":\"" + sid + "\"}", MediaType.APPLICATION_JSON));

                emitter.complete();
            } catch (Exception e) {
                emitter.completeWithError(e);
            } finally {
                executor.shutdown();
            }
        });

        return emitter;
    }

    @GetMapping("/{id}/chat/history")
    public ResponseEntity<?> getHistory(
            @PathVariable Long id,
            @RequestParam(required = false) String sessionId) {
        if (!projectRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        if (sessionId != null) {
            List<ChatMessageEntity> messages = chatMessageRepository
                    .findByProjectIdAndSessionIdOrderByTimestampAsc(id, sessionId);
            return ResponseEntity.ok(messages);
        }
        // Return all sessions grouped
        List<ChatMessageEntity> allMessages = chatMessageRepository.findByProjectIdOrderByTimestampDesc(id);
        return ResponseEntity.ok(allMessages);
    }

    @GetMapping("/{id}/chat/sessions")
    public ResponseEntity<List<SessionInfo>> getSessions(@PathVariable Long id) {
        if (!projectRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        List<ChatMessageEntity> allMessages = chatMessageRepository.findByProjectIdOrderByTimestampDesc(id);

        // Group by sessionId, take first message as title
        var sessionMap = new java.util.LinkedHashMap<String, SessionInfo>();
        for (ChatMessageEntity msg : allMessages) {
            if (!sessionMap.containsKey(msg.getSessionId())) {
                String title = msg.getRole().equals("user")
                        ? (msg.getContent().length() > 80 ? msg.getContent().substring(0, 80) + "..." : msg.getContent())
                        : "New Chat";
                sessionMap.put(msg.getSessionId(), new SessionInfo(
                        msg.getSessionId(),
                        title,
                        msg.getTimestamp()
                ));
            }
        }

        return ResponseEntity.ok(sessionMap.values().stream().toList());
    }

    @DeleteMapping("/{id}/chat/{sessionId}")
    public ResponseEntity<Void> deleteSession(@PathVariable Long id, @PathVariable String sessionId) {
        chatMessageRepository.deleteByProjectIdAndSessionId(id, sessionId);
        return ResponseEntity.noContent().build();
    }

    private String renderTree(FileService.FileTreeNode node, int depth) {
        StringBuilder sb = new StringBuilder();
        String indent = "  ".repeat(depth);
        if ("directory".equals(node.type())) {
            sb.append(indent).append(node.name()).append("/\n");
            if (node.children() != null) {
                for (FileService.FileTreeNode child : node.children()) {
                    sb.append(renderTree(child, depth + 1));
                }
            }
        } else {
            sb.append(indent).append(node.name());
            if (node.language() != null) sb.append(" (").append(node.language()).append(")");
            sb.append("\n");
        }
        return sb.toString();
    }

    public record ChatRequest(String message, String sessionId) {}

    public record SessionInfo(String sessionId, String title, LocalDateTime lastMessageTime) {}
}
