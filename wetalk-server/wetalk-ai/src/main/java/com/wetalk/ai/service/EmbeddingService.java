package com.wetalk.ai.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wetalk.ai.config.AiProperties;
import com.wetalk.common.BizException;
import com.wetalk.common.ErrorCode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.Map;

/**
 * 向量化：Ollama /api/embeddings（nomic-embed-text，768 维）。
 * RAG 知识库的 embedding 入口；模型未拉取时抛业务错误（前端提示 ollama pull）。
 */
@Service
public class EmbeddingService {

    private static final Logger log = LoggerFactory.getLogger(EmbeddingService.class);

    private final AiProperties aiProperties;
    private final RestClient restClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public EmbeddingService(AiProperties aiProperties) {
        this.aiProperties = aiProperties;
        var factory = new org.springframework.http.client.SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5000);
        factory.setReadTimeout(30000);
        this.restClient = RestClient.builder()
                .baseUrl(aiProperties.getOllamaUrl())
                .requestFactory(factory)
                .build();
    }

    /** 文本向量化（nomic-embed-text 输出 768 维） */
    public float[] embed(String text) {
        try {
            String resp = restClient.post()
                    .uri("/api/embeddings")
                    .body(Map.of(
                            "model", aiProperties.getOllamaEmbedModel(),
                            "prompt", text))
                    .retrieve()
                    .body(String.class);
            var arr = objectMapper.readTree(resp == null ? "{}" : resp).path("embedding");
            if (!arr.isArray() || arr.isEmpty()) {
                throw new BizException(ErrorCode.SYSTEM_ERROR,
                        "向量化失败，请先执行 ollama pull " + aiProperties.getOllamaEmbedModel());
            }
            float[] vector = new float[arr.size()];
            for (int i = 0; i < arr.size(); i++) {
                vector[i] = (float) arr.get(i).asDouble();
            }
            return vector;
        } catch (BizException e) {
            throw e;
        } catch (Exception e) {
            log.error("ollama embedding failed, model={}", aiProperties.getOllamaEmbedModel(), e);
            throw new BizException(ErrorCode.SYSTEM_ERROR, "AI 服务暂不可用，无法向量化");
        }
    }
}
