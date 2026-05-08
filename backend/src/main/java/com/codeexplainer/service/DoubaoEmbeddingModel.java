package com.codeexplainer.service;

import org.springframework.ai.document.Document;
import org.springframework.ai.embedding.BatchingStrategy;
import org.springframework.ai.embedding.Embedding;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.ai.embedding.EmbeddingOptions;
import org.springframework.ai.embedding.EmbeddingRequest;
import org.springframework.ai.embedding.EmbeddingResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Primary;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
@Primary
public class DoubaoEmbeddingModel implements EmbeddingModel {

    private final String apiUrl;
    private final String apiKey;
    private final String model;
    private final RestTemplate restTemplate;

    public DoubaoEmbeddingModel(
            @Value("${app.embedding.base-url:https://ark.cn-beijing.volces.com/api/v3/embeddings/multimodal}") String apiUrl,
            @Value("${app.embedding.api-key:}") String apiKey,
            @Value("${app.embedding.model:doubao-embedding-vision-251215}") String model) {
        this.apiUrl = apiUrl;
        this.apiKey = apiKey;
        this.model = model;
        this.restTemplate = new RestTemplate();
    }

    @Override
    public EmbeddingResponse call(EmbeddingRequest request) {
        List<Map<String, Object>> inputs = new ArrayList<>();
        for (String text : request.getInstructions()) {
            inputs.add(Map.of("type", "text", "text", text));
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiKey);

        Map<String, Object> body = Map.of(
                "model", model,
                "input", inputs
        );

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

        @SuppressWarnings("unchecked")
        Map<String, Object> response = restTemplate.postForObject(apiUrl, entity, Map.class);

        List<Embedding> embeddings = new ArrayList<>();
        if (response != null && response.get("data") != null) {
            Object dataObj = response.get("data");
            List<Map<String, Object>> dataList;

            if (dataObj instanceof List) {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> casted = (List<Map<String, Object>>) dataObj;
                dataList = casted;
            } else if (dataObj instanceof Map) {
                @SuppressWarnings("unchecked")
                Map<String, Object> map = (Map<String, Object>) dataObj;
                dataList = List.of(map);
            } else {
                dataList = List.of();
            }

            for (Map<String, Object> item : dataList) {
                @SuppressWarnings("unchecked")
                List<Number> embeddingList = (List<Number>) item.get("embedding");
                if (embeddingList == null) continue;
                float[] floatArray = new float[embeddingList.size()];
                for (int i = 0; i < embeddingList.size(); i++) {
                    floatArray[i] = embeddingList.get(i).floatValue();
                }
                int index = item.get("index") != null ? ((Number) item.get("index")).intValue() : 0;
                embeddings.add(new Embedding(floatArray, index));
            }
        }

        return new EmbeddingResponse(embeddings);
    }

    @Override
    public float[] embed(Document document) {
        EmbeddingResponse response = call(new EmbeddingRequest(List.of(document.getText()), null));
        return response.getResult().getOutput();
    }

    @Override
    public float[] embed(String text) {
        EmbeddingResponse response = call(new EmbeddingRequest(List.of(text), null));
        return response.getResult().getOutput();
    }

    @Override
    public List<float[]> embed(List<Document> documents, EmbeddingOptions options, BatchingStrategy batchingStrategy) {
        List<float[]> results = new ArrayList<>(documents.size());
        for (Document doc : documents) {
            results.add(embed(doc));
        }
        return results;
    }

    @Override
    public int dimensions() {
        return 1024;
    }
}
