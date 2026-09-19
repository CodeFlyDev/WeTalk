package com.wetalk.message.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 白板操作上报（WS /app/whiteboard）：
 * event = STROKE（笔画 JSON）/ CLEAR（清空）；data 为笔画 JSON 字符串（CLEAR 时为空）
 */
public record WhiteboardRequest(
        @NotBlank String conversationId,
        @NotBlank String event,
        @Size(max = 8192, message = "笔画数据过大") String data) {
}
