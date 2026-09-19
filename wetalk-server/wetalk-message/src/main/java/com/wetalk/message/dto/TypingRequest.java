package com.wetalk.message.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 输入中状态上报载荷（WS /app/typing）
 */
public record TypingRequest(@NotBlank String conversationId) {
}
