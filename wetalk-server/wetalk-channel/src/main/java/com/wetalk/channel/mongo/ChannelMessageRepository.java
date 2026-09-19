package com.wetalk.channel.mongo;

import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface ChannelMessageRepository extends MongoRepository<ChannelMessageDoc, String> {

    /** 倒序取最近一页（服务层翻转为正序返回） */
    List<ChannelMessageDoc> findByChannelIdOrderByCreatedAtDesc(Long channelId, Pageable pageable);
}
