package com.wetalk.message.search;

import org.springframework.data.elasticsearch.repository.ElasticsearchRepository;

/**
 * 消息检索仓储（仅用于删除；检索走 ElasticsearchOperations 原生查询）
 */
public interface MessageSearchRepository extends ElasticsearchRepository<MessageSearchDoc, String> {
}
