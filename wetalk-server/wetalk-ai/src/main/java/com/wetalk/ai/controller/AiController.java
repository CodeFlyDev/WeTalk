package com.wetalk.ai.controller;

import com.wetalk.ai.service.TranscribeService;
import com.wetalk.auth.security.CurrentUser;
import com.wetalk.common.ApiResult;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * AI 能力入口（当前：语音转写；后续：AI 助手、摘要、翻译）
 */
@RestController
@RequestMapping("/api/ai")
public class AiController {

    private final TranscribeService transcribeService;

    public AiController(TranscribeService transcribeService) {
        this.transcribeService = transcribeService;
    }

    /** 语音消息转文字（仅会话参与者） */
    @GetMapping("/transcribe")
    public ApiResult<String> transcribe(@RequestParam String messageId) {
        return ApiResult.ok(transcribeService.transcribe(CurrentUser.id(), messageId));
    }
}
