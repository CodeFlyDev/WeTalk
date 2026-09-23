package com.wetalk.message.search;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.elasticsearch.repository.ElasticsearchRepository;

/**
 * 消息检索仓储（仅用于删除；检索走 ElasticsearchOperations 原生查询）
 */
@ConditionalOnProperty(prefix = "wetalk.es", name = "enabled", havingValue = "true", matchIfMissing = false)
public interface MessageSearchRepository extends ElasticsearchRepository<MessageSearchDoc, String> {
}
