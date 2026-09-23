package com.wetalk.ai.controller;

import com.wetalk.ai.dto.ChatRequest;
import com.wetalk.ai.service.KnowledgeService;
import com.wetalk.ai.service.OllamaService;
import com.wetalk.ai.service.TranscribeService;
import com.wetalk.common.security.CurrentUser;
import com.wetalk.common.ApiResult;
import jakarta.validation.Valid;
import org.springframework.lang.Nullable;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * AI 能力入口：语音转写 / AI 助手（Ollama）/ 聊天摘要
 */
@RestController
@RequestMapping("/api/ai")
public class AiController {

    private final TranscribeService transcribeService;
    private final OllamaService ollamaService;
    private final @Nullable KnowledgeService knowledgeService;

    public AiController(TranscribeService transcribeService, OllamaService ollamaService,
                        @Nullable KnowledgeService knowledgeService) {
        this.transcribeService = transcribeService;
        this.ollamaService = ollamaService;
        this.knowledgeService = knowledgeService;
    }

    /** 语音消息转文字（仅会话参与者） */
    @GetMapping("/transcribe")
    public ApiResult<String> transcribe(@RequestParam String messageId) {
        return ApiResult.ok(transcribeService.transcribe(CurrentUser.id(), messageId));
    }

    /** AI 助手对话（历史由客户端携带，服务端不落库；useKnowledge=true 时检索知识库注入） */
    @PostMapping("/chat")
    public ApiResult<String> chat(@Valid @RequestBody ChatRequest request) {
        String context = Boolean.TRUE.equals(request.useKnowledge()) && knowledgeService != null
                ? knowledgeService.buildContext(CurrentUser.id(), request.message(), 3)
                : null;
        return ApiResult.ok(ollamaService.chat(request.history(), request.message(), context));
    }

    /** 表情包文案生成（图像由前端 canvas 模板合成） */
    public record StickerRequest(String prompt) {
    }

    @PostMapping("/sticker")
    public ApiResult<OllamaService.StickerText> sticker(@org.springframework.web.bind.annotation.RequestBody StickerRequest request) {
        if (request.prompt() == null || request.prompt().isBlank()) {
            throw new com.wetalk.common.BizException(com.wetalk.common.ErrorCode.BAD_REQUEST, "主题不能为空");
        }
        return ApiResult.ok(ollamaService.sticker(request.prompt().trim()));
    }

    /** 聊天摘要（仅会话参与者，取最近 50 条有效消息） */
    @PostMapping("/summary")
    public ApiResult<String> summary(@RequestParam String conversationId) {
        return ApiResult.ok(ollamaService.summarize(CurrentUser.id(), conversationId));
    }

    /* ---------- RAG 知识库（ES dense_vector 复用） ---------- */

    public record KnowledgeAddRequest(String title, String text) {
    }

    /** 粘贴文本入库（切块 + 向量化） */
    @PostMapping("/knowledge")
    public ApiResult<KnowledgeService.KnowledgeDocView> addKnowledge(
            @org.springframework.web.bind.annotation.RequestBody KnowledgeAddRequest request) {
        if (knowledgeService == null) throw new com.wetalk.common.BizException(com.wetalk.common.ErrorCode.BAD_REQUEST, "知识库未启用");
        if (request.text() == null || request.text().isBlank()) {
            throw new com.wetalk.common.BizException(com.wetalk.common.ErrorCode.BAD_REQUEST, "文本内容不能为空");
        }
        return ApiResult.ok(knowledgeService.add(CurrentUser.id(), request.title(), request.text()));
    }

    /** 我的文档列表 */
    @GetMapping("/knowledge")
    public ApiResult<List<KnowledgeService.KnowledgeDocView>> myKnowledge() {
        if (knowledgeService == null) return ApiResult.ok(List.of());
        return ApiResult.ok(knowledgeService.docs(CurrentUser.id()));
    }

    /** 删除整篇文档 */
    @org.springframework.web.bind.annotation.DeleteMapping("/knowledge/{docId}")
    public ApiResult<Void> deleteKnowledge(@org.springframework.web.bind.annotation.PathVariable String docId) {
        if (knowledgeService != null) knowledgeService.delete(CurrentUser.id(), docId);
        return ApiResult.ok(null);
    }
}
