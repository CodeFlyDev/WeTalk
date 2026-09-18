package com.wetalk.message.dto;

import com.wetalk.common.MessageType;

import java.time.LocalDateTime;

/**
 * 消息视图（推送与补拉共用载荷）
 */
public record MessageView(
        String id,
        String conversationId,
        Long senderId,
        Long receiverId,
        Long groupId,
        MessageType type,
        String content,
        String refObjectKey,
        String clientMsgId,
        LocalDateTime createdAt) {
}
