package com.wetalk.ai.dto;

import com.wetalk.ai.service.OllamaService;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * AI 助手对话请求：客户端携带本地历史（旧→新），服务端裁剪到最近 20 条
 */
public record ChatRequest(
        @NotBlank(message = "消息不能为空")
        @Size(max = 2000, message = "消息过长（上限 2000 字）")
        String message,
        List<OllamaService.ChatMessage> history,
        /** 是否引用知识库（RAG，可选） */
        Boolean useKnowledge) {
}
