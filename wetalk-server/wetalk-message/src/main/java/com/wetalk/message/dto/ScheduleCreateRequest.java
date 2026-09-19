package com.wetalk.message.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

/**
 * 创建定时消息请求：单聊填 receiverId，群聊填 groupId（二选一）
 */
public record ScheduleCreateRequest(
        Long receiverId,
        Long groupId,
        @NotBlank(message = "内容不能为空")
        @Size(max = 4096, message = "内容最长 4096 字符")
        String content,
        LocalDateTime sendAt) {
}
