package com.wetalk.message.dto;

import com.wetalk.common.MessageType;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 消息视图（推送与补拉共用载荷）。
 * 撤回事件复用本结构：type=RECALL，id=被撤回原消息 ID，recalled=true。
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
        String replyToId,
        List<Long> mentionedUserIds,
        String clientMsgId,
        boolean recalled,
        LocalDateTime createdAt) {
}
