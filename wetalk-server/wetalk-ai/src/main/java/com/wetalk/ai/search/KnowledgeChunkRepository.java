package com.wetalk.ai.search;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.elasticsearch.repository.ElasticsearchRepository;

import java.util.List;

@ConditionalOnProperty(prefix = "wetalk.es", name = "enabled", havingValue = "true", matchIfMissing = false)
public interface KnowledgeChunkRepository extends ElasticsearchRepository<KnowledgeChunkDoc, String> {

    List<KnowledgeChunkDoc> findByUserId(Long userId);

    List<KnowledgeChunkDoc> findByDocIdAndUserIdOrderByChunkIndexAsc(String docId, Long userId);

    void deleteByDocIdAndUserId(String docId, Long userId);
}
