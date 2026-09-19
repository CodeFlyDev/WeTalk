package com.wetalk.channel.mongo;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

/**
 * 频道消息（MongoDB channel_messages 集合，纯文字）。
 * 偏离主消息链路：无未读/离线投递/ES 索引，社区广场定位（在线广播 + 历史查询）。
 */
@Document(collection = "channel_messages")
@CompoundIndex(name = "idx_channel_created", def = "{'channelId': 1, 'createdAt': -1}")
public class ChannelMessageDoc {

    @Id
    private String id;

    private Long channelId;

    private Long senderId;

    private String content;

    private LocalDateTime createdAt;

    public String getId() {
        return id;
    }

    public Long getChannelId() {
        return channelId;
    }

    public void setChannelId(Long channelId) {
        this.channelId = channelId;
    }

    public Long getSenderId() {
        return senderId;
    }

    public void setSenderId(Long senderId) {
        this.senderId = senderId;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
