package com.wetalk.message.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

/**
 * 创建待办请求
 */
public record TodoCreateRequest(
        @NotBlank(message = "待办内容不能为空")
        @Size(max = 512, message = "待办内容最长 512 字符")
        String content,
        LocalDateTime dueAt) {
}
