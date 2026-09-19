package com.wetalk.ai.search;

import org.springframework.data.elasticsearch.repository.ElasticsearchRepository;

import java.util.List;

public interface KnowledgeChunkRepository extends ElasticsearchRepository<KnowledgeChunkDoc, String> {

    List<KnowledgeChunkDoc> findByUserId(Long userId);

    List<KnowledgeChunkDoc> findByDocIdAndUserIdOrderByChunkIndexAsc(String docId, Long userId);

    void deleteByDocIdAndUserId(String docId, Long userId);
}
