package com.wetalk.message.controller;

import com.wetalk.auth.security.CurrentUser;
import com.wetalk.common.ApiResult;
import com.wetalk.message.dto.MessageView;
import com.wetalk.message.dto.SendMessageRequest;
import com.wetalk.message.dto.SendResult;
import com.wetalk.message.service.MessageService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

/**
 * 消息 REST：发送 / 离线补拉 / 未读
 */
@RestController
@RequestMapping("/api/messages")
public class MessageController {

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    private final MessageService messageService;

    public MessageController(MessageService messageService) {
        this.messageService = messageService;
    }

    @PostMapping
    public ApiResult<SendResult> send(@Valid @RequestBody SendMessageRequest request) {
        return ApiResult.ok(messageService.send(CurrentUser.id(), request));
    }

    @GetMapping("/history")
    public ApiResult<List<MessageView>> history(
            @RequestParam String conversationId,
            @RequestParam(required = false) String before,
            @RequestParam(defaultValue = "20") int limit) {
        LocalDateTime beforeTime = before == null || before.isBlank() ? null : LocalDateTime.parse(before, ISO);
        return ApiResult.ok(messageService.history(conversationId, beforeTime, limit));
    }

    @GetMapping("/unread")
    public ApiResult<Map<String, Long>> unread(@RequestParam String conversationIds) {
        List<String> ids = Arrays.stream(conversationIds.split(","))
                .map(String::trim).filter(s -> !s.isEmpty()).toList();
        return ApiResult.ok(messageService.unread(CurrentUser.id(), ids));
    }

    @PostMapping("/unread/clear")
    public ApiResult<Void> clearUnread(@RequestParam String conversationId) {
        messageService.clearUnread(CurrentUser.id(), conversationId);
        return ApiResult.ok(null);
    }
}
