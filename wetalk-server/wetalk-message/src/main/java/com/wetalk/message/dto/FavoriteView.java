package com.wetalk.message.dto;

import com.wetalk.common.MessageType;

import java.time.LocalDateTime;

/**
 * 收藏视图（消息副本 + 收藏时间）
 */
public record FavoriteView(
        Long id,
        String messageId,
        String conversationId,
        Long senderId,
        MessageType type,
        String content,
        String refObjectKey,
        LocalDateTime createdAt) {
}
