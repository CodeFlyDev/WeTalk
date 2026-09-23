package com.wetalk.ai.service;

import co.elastic.clients.json.JsonData;
import com.wetalk.ai.search.KnowledgeChunkDoc;
import com.wetalk.ai.search.KnowledgeChunkRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.elasticsearch.client.elc.NativeQuery;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.data.elasticsearch.core.SearchHit;
import org.springframework.data.elasticsearch.core.SearchHits;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * RAG 知识库：文本粘贴 → 500 字切块 → nomic-embed-text 向量化 → ES dense_vector 入库；
 * 检索用 script_score 余弦相似度（复用既有 ES，偏离原规划 Milvus，零新增基础设施）。
 * ES / Ollama 故障静默降级（检索返回空、入库抛业务错误）。
 */
@Service
@ConditionalOnProperty(prefix = "wetalk.es", name = "enabled", havingValue = "true", matchIfMissing = false)
public class KnowledgeService {

    private static final Logger log = LoggerFactory.getLogger(KnowledgeService.class);

    private static final int CHUNK_SIZE = 500;
    private static final int MAX_TEXT_LENGTH = 20000;

    private final KnowledgeChunkRepository repository;
    private final ElasticsearchOperations operations;
    private final EmbeddingService embeddingService;

    public KnowledgeService(KnowledgeChunkRepository repository,
                            ElasticsearchOperations operations,
                            EmbeddingService embeddingService) {
        this.repository = repository;
        this.operations = operations;
        this.embeddingService = embeddingService;
    }

    public record KnowledgeDocView(String docId, String title, int chunks, LocalDateTime createdAt) {
    }

    public record KnowledgeHit(String title, String chunkText, double score) {
    }

    /** 粘贴文本入库：切块 → 向量化 → 索引，返回文档视图 */
    public KnowledgeDocView add(Long userId, String title, String text) {
        String clean = text.strip();
        if (clean.length() > MAX_TEXT_LENGTH) {
            throw new com.wetalk.common.BizException(com.wetalk.common.ErrorCode.BIZ_ERROR,
                    "文本过长（上限 " + MAX_TEXT_LENGTH / 1000 + "k 字）");
        }
        String docTitle = title == null || title.isBlank() ? "未命名" : title.strip();
        String docId = UUID.randomUUID().toString();
        List<String> chunks = splitChunks(clean, CHUNK_SIZE);
        LocalDateTime now = LocalDateTime.now();
        for (int i = 0; i < chunks.size(); i++) {
            KnowledgeChunkDoc doc = new KnowledgeChunkDoc();
            doc.setId(docId + ":" + i);
            doc.setUserId(userId);
            doc.setDocId(docId);
            doc.setTitle(docTitle);
            doc.setChunkText(chunks.get(i));
            doc.setChunkIndex(i);
            doc.setVector(embeddingService.embed(chunks.get(i)));
            doc.setCreatedAt(now);
            try {
                repository.save(doc);
            } catch (Exception e) {
                log.warn("knowledge chunk save failed, docId={}, chunk={}", docId, i, e);
            }
        }
        return new KnowledgeDocView(docId, docTitle, chunks.size(), now);
    }

    /** 我的文档列表（按 docId 分组） */
    public List<KnowledgeDocView> docs(Long userId) {
        Map<String, KnowledgeDocView> byDoc = new LinkedHashMap<>();
        for (KnowledgeChunkDoc chunk : repository.findByUserId(userId)) {
            byDoc.merge(chunk.getDocId(),
                    new KnowledgeDocView(chunk.getDocId(), chunk.getTitle(), 1, chunk.getCreatedAt()),
                    (acc, ignored) -> new KnowledgeDocView(acc.docId(), acc.title(), acc.chunks() + 1, acc.createdAt()));
        }
        return byDoc.values().stream().toList();
    }

    /** 删除整篇文档（校验归属） */
    public void delete(Long userId, String docId) {
        List<KnowledgeChunkDoc> chunks = repository.findByDocIdAndUserIdOrderByChunkIndexAsc(docId, userId);
        if (chunks.isEmpty()) {
            throw new com.wetalk.common.BizException(com.wetalk.common.ErrorCode.NOT_FOUND, "文档不存在");
        }
        repository.deleteAll(chunks);
    }

    /**
     * 检索：查询向量化 → script_score 余弦相似度（+1 防 0 分），过滤本人，Top k。
     * 故障静默降级返回空列表（不影响 AI 对话主链路）。
     */
    public String buildContext(Long userId, String query, int topK) {
        List<KnowledgeHit> hits = search(userId, query, topK);
        if (hits.isEmpty()) {
            return null;
        }
        StringBuilder sb = new StringBuilder();
        for (KnowledgeHit hit : hits) {
            sb.append("【").append(hit.title()).append("】")
                    .append(hit.chunkText(), 0, Math.min(hit.chunkText().length(), 400))
                    .append('\n');
        }
        return sb.toString();
    }

    public List<KnowledgeHit> search(Long userId, String query, int topK) {
        try {
            float[] vector = embeddingService.embed(query);
            List<JsonData> qv = new ArrayList<>(vector.length);
            for (float v : vector) {
                qv.add(JsonData.of(v));
            }
            NativeQuery nativeQuery = NativeQuery.builder()
                    .withQuery(q -> q.scriptScore(ss -> ss
                            .query(inner -> inner.term(t -> t.field("userId").value(userId)))
                            .script(s -> s
                                    .source("cosineSimilarity(params.qv, 'vector') + 1.0")
                                    .params(Map.of("qv", JsonData.of(qv))))))
                    .withMaxResults(Math.max(1, topK))
                    .build();
            SearchHits<KnowledgeChunkDoc> hits = operations.search(nativeQuery, KnowledgeChunkDoc.class);
            return hits.stream()
                    .map(SearchHit::getContent)
                    .map(d -> new KnowledgeHit(d.getTitle(), d.getChunkText(), 0))
                    .toList();
        } catch (Exception e) {
            log.warn("knowledge search failed, fallback empty, userId={}", userId, e);
            return List.of();
        }
    }

    /** 简单固定窗口切块（中文无空格分词，段落优先、超长硬切） */
    static List<String> splitChunks(String text, int size) {
        List<String> chunks = new ArrayList<>();
        for (String paragraph : text.split("\n+")) {
            String p = paragraph.strip();
            if (p.isEmpty()) {
                continue;
            }
            for (int i = 0; i < p.length(); i += size) {
                chunks.add(p.substring(i, Math.min(p.length(), i + size)));
            }
        }
        if (chunks.isEmpty()) {
            chunks.add(text);
        }
        return chunks;
    }
}
