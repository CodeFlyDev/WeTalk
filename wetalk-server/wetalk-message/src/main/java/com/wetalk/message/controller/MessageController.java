package com.wetalk.message.controller;

import com.wetalk.auth.security.CurrentUser;
import com.wetalk.common.ApiResult;
import com.wetalk.message.dto.ForwardRequest;
import com.wetalk.message.dto.GroupFileView;
import com.wetalk.message.dto.MessageView;
import com.wetalk.message.dto.SendMessageRequest;
import com.wetalk.message.dto.SendResult;
import com.wetalk.message.service.MessageService;
import com.wetalk.message.service.WhiteboardService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
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
    private final WhiteboardService whiteboardService;

    public MessageController(MessageService messageService, WhiteboardService whiteboardService) {
        this.messageService = messageService;
        this.whiteboardService = whiteboardService;
    }

    @PostMapping
    public ApiResult<SendResult> send(@Valid @RequestBody SendMessageRequest request) {
        return ApiResult.ok(messageService.send(CurrentUser.id(), request));
    }

    /** 按 ID 查询单条消息（引用条回显） */
    @GetMapping("/{id}")
    public ApiResult<MessageView> get(@PathVariable String id) {
        return ApiResult.ok(messageService.get(CurrentUser.id(), id));
    }

    /** 会话内全文检索（ES 索引，故障降级返回空列表） */
    @GetMapping("/search")
    public ApiResult<List<MessageView>> search(@RequestParam String conversationId,
                                               @RequestParam String keyword,
                                               @RequestParam(defaultValue = "20") int limit) {
        return ApiResult.ok(messageService.search(CurrentUser.id(), conversationId, keyword, limit));
    }

    /** 全局检索与我相关的消息（我的单聊 + 我所在的群聊） */
    @GetMapping("/search/global")
    public ApiResult<List<MessageView>> searchGlobal(@RequestParam String keyword,
                                                     @RequestParam(defaultValue = "20") int limit) {
        return ApiResult.ok(messageService.searchGlobal(CurrentUser.id(), keyword, limit));
    }

    /** 撤回自己发送的消息（2 分钟内） */
    @PostMapping("/{id}/recall")
    public ApiResult<MessageView> recall(@PathVariable String id) {
        return ApiResult.ok(messageService.recall(CurrentUser.id(), id));
    }

    /** 阅后即焚：接收方阅读后触发（内容清空，双方展示焚毁占位） */
    @PostMapping("/{id}/burn")
    public ApiResult<MessageView> burn(@PathVariable String id) {
        return ApiResult.ok(messageService.burn(CurrentUser.id(), id));
    }

    /** 白板历史全量回放（笔画 JSON 列表，按序） */
    @GetMapping("/whiteboard")
    public ApiResult<List<String>> whiteboard(@RequestParam String conversationId) {
        return ApiResult.ok(whiteboardService.history(CurrentUser.id(), conversationId));
    }

    /** 置顶消息（会话参与者均可） */
    @PostMapping("/{id}/pin")
    public ApiResult<MessageView> pin(@PathVariable String id) {
        return ApiResult.ok(messageService.setPinned(CurrentUser.id(), id, true));
    }

    /** 取消置顶 */
    @DeleteMapping("/{id}/pin")
    public ApiResult<MessageView> unpin(@PathVariable String id) {
        return ApiResult.ok(messageService.setPinned(CurrentUser.id(), id, false));
    }

    /** 会话置顶消息列表 */
    @GetMapping("/pinned")
    public ApiResult<List<MessageView>> pinned(@RequestParam String conversationId) {
        return ApiResult.ok(messageService.pinned(CurrentUser.id(), conversationId));
    }

    /** 转发消息到多个目标会话（产生全新消息） */
    @PostMapping("/{id}/forward")
    public ApiResult<List<SendResult>> forward(@PathVariable String id,
                                               @Valid @RequestBody ForwardRequest request) {
        return ApiResult.ok(messageService.forward(CurrentUser.id(), id, request));
    }

    /** 群文件：聚合群会话内 type=FILE 消息 */
    @GetMapping("/group-files")
    public ApiResult<List<GroupFileView>> groupFiles(@RequestParam Long groupId) {
        return ApiResult.ok(messageService.groupFiles(CurrentUser.id(), groupId));
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
