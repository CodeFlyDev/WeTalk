package com.wetalk.common;

import java.time.LocalDateTime;

/**
 * 消息产生事件（开放平台 Webhook 推送用，Spring 应用事件解耦）。
 * open 模块监听后按接收方配置的 Webhook 异步推送；群消息不推送（广播量不可控）。
 */
public record WebhookEvent(
        String messageId,
        String conversationId,
        Long senderId,
        Long receiverId,
        Long groupId,
        String type,
        String content,
        LocalDateTime createdAt) {
}
