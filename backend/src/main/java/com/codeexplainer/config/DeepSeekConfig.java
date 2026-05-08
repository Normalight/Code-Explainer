package com.codeexplainer.config;

import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.ai.openai.api.OpenAiApi;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpRequest;
import org.springframework.http.client.ClientHttpRequestExecution;
import org.springframework.http.client.ClientHttpRequestInterceptor;
import org.springframework.http.client.ClientHttpResponse;
import org.springframework.web.client.RestClient;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

@Configuration
public class DeepSeekConfig {

    @Bean
    public OpenAiApi openAiApi(
            @Value("${spring.ai.openai.base-url}") String baseUrl,
            @Value("${spring.ai.openai.api-key}") String apiKey) {
        RestClient.Builder restClientBuilder = RestClient.builder()
                .requestInterceptor(new ThinkingDisableInterceptor());

        return OpenAiApi.builder()
                .apiKey(apiKey)
                .baseUrl(baseUrl)
                .restClientBuilder(restClientBuilder)
                .build();
    }

    static class ThinkingDisableInterceptor implements ClientHttpRequestInterceptor {
        @Override
        public ClientHttpResponse intercept(HttpRequest request, byte[] body,
                                            ClientHttpRequestExecution execution) throws IOException {
            String json = new String(body, StandardCharsets.UTF_8);
            if (json.startsWith("{") && json.endsWith("}")) {
                json = json.substring(0, json.length() - 1) + ",\"thinking\":{\"type\":\"disabled\"}}";
            }
            return execution.execute(request, json.getBytes(StandardCharsets.UTF_8));
        }
    }
}
