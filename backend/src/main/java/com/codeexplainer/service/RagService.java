package com.codeexplainer.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.SearchRequest;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
@Slf4j
public class RagService {

    private static final int MAX_CHUNK_LINES = 50;

    private final VectorStore vectorStore;

    @Autowired
    public RagService(@Autowired(required = false) VectorStore vectorStore) {
        this.vectorStore = vectorStore;
    }

    public boolean isAvailable() {
        return vectorStore != null;
    }

    public void indexProject(Long projectId, List<ProjectChunk> chunks) {
        if (vectorStore == null || chunks.isEmpty()) return;
        try {
            List<Document> documents = new ArrayList<>();
            for (ProjectChunk chunk : chunks) {
                Document doc = new Document(chunk.content(), Map.of(
                        "projectId", String.valueOf(projectId),
                        "filePath", chunk.filePath(),
                        "language", chunk.language() != null ? chunk.language() : "",
                        "startLine", String.valueOf(chunk.startLine()),
                        "endLine", String.valueOf(chunk.endLine()),
                        "type", chunk.type() != null ? chunk.type() : ""
                ));
                documents.add(doc);
            }
            vectorStore.add(documents);
            log.info("Indexed {} chunks for project {}", documents.size(), projectId);
        } catch (Exception e) {
            log.warn("RAG indexing failed for project {}: {}", projectId, e.getMessage(), e);
        }
    }

    public String searchAndBuildContext(Long projectId, String query, int topK) {
        if (vectorStore == null) return "";
        try {
            List<Document> results = vectorStore.similaritySearch(
                    SearchRequest.builder()
                            .query(query)
                            .topK(topK)
                            .filterExpression("projectId == " + projectId)
                            .build()
            );

            if (results.isEmpty()) return "";

            StringBuilder sb = new StringBuilder();
            for (Document doc : results) {
                String filePath = String.valueOf(doc.getMetadata().get("filePath"));
                String startLine = String.valueOf(doc.getMetadata().get("startLine"));
                String endLine = String.valueOf(doc.getMetadata().get("endLine"));
                sb.append("### ").append(filePath).append(" (L").append(startLine).append("-L").append(endLine).append(")\n");
                sb.append("```\n").append(doc.getText()).append("\n```\n\n");
            }
            return sb.toString();
        } catch (Exception e) {
            log.warn("RAG search failed: {}", e.getMessage());
            return "";
        }
    }

    public List<ProjectChunk> chunkFile(String filePath, String language, String content) {
        List<ProjectChunk> chunks = new ArrayList<>();
        String[] lines = content.split("\n", -1);
        int totalLines = lines.length;

        List<AstNode> astNodes = TreeSitterAstParser.parse(content, language);
        if (!astNodes.isEmpty()) {
            for (int i = 0; i < astNodes.size(); i++) {
                AstNode node = astNodes.get(i);
                int start = node.startLine();
                int end = (i + 1 < astNodes.size())
                        ? astNodes.get(i + 1).startLine() - 1
                        : totalLines;
                StringBuilder code = new StringBuilder();
                for (int j = start - 1; j < end && j < totalLines; j++) {
                    code.append(lines[j]);
                    if (j < end - 1) code.append("\n");
                }
                chunks.add(new ProjectChunk(filePath, language, start, end, node.type(), code.toString()));
            }
        } else {
            addGapChunks(chunks, filePath, language, lines, 1, totalLines);
            return chunks;
        }

        int coveredEnd = 0;
        List<ProjectChunk> gapChunks = new ArrayList<>();
        for (ProjectChunk chunk : chunks) {
            if (chunk.startLine() > coveredEnd + 1) {
                addGapChunks(gapChunks, filePath, language, lines, coveredEnd + 1, chunk.startLine() - 1);
            }
            coveredEnd = Math.max(coveredEnd, chunk.endLine());
        }
        if (coveredEnd < totalLines) {
            addGapChunks(gapChunks, filePath, language, lines, coveredEnd + 1, totalLines);
        }
        chunks.addAll(gapChunks);

        chunks.sort((a, b) -> Integer.compare(a.startLine(), b.startLine()));
        return chunks;
    }

    private void addGapChunks(List<ProjectChunk> chunks, String filePath, String language,
                               String[] lines, int from, int to) {
        if (from > to || from < 1) return;
        int start = from;
        while (start <= to) {
            int end = Math.min(start + MAX_CHUNK_LINES - 1, to);
            StringBuilder code = new StringBuilder();
            for (int i = start - 1; i < end; i++) {
                code.append(lines[i]);
                if (i < end - 1) code.append("\n");
            }
            chunks.add(new ProjectChunk(filePath, language, start, end, "block", code.toString()));
            start = end + 1;
        }
    }

    public record ProjectChunk(String filePath, String language, int startLine, int endLine, String type, String content) {}
}
