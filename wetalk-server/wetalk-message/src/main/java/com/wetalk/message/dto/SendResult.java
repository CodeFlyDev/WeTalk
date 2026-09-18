package com.wetalk.message.dto;

import java.time.LocalDateTime;

/**
 * 发送回执（REST 响应 / WS /queue/ack）
 */
public record SendResult(
        String messageId,
        String conversationId,
        String clientMsgId,
        LocalDateTime createdAt) {
}
