package com.wetalk.open.controller;

import com.wetalk.common.security.CurrentUser;
import com.wetalk.common.ApiResult;
import com.wetalk.message.dto.MessageView;
import com.wetalk.message.dto.SendMessageRequest;
import com.wetalk.message.dto.SendResult;
import com.wetalk.message.service.MessageService;
import com.wetalk.open.entity.ApiKey;
import com.wetalk.open.service.ApiKeyService;
import com.wetalk.user.service.UserService;
import jakarta.validation.constraints.NotBlank;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 开放平台接口：
 * - /api/open/keys   —— JWT 身份管理自己的 API Key（创建/列表/撤销）
 * - /api/open/me|messages —— X-Api-Key 调用开放 API（机器人场景）
 */
@RestController
@RequestMapping("/api/open")
public class OpenApiController {

    private final ApiKeyService apiKeyService;
    private final MessageService messageService;
    private final UserService userService;

    public OpenApiController(ApiKeyService apiKeyService,
                             MessageService messageService,
                             UserService userService) {
        this.apiKeyService = apiKeyService;
        this.messageService = messageService;
        this.userService = userService;
    }

    /* ---------- API Key 管理（JWT） ---------- */

    public record CreateKeyRequest(@NotBlank String name) {
    }

    public record ApiKeyView(Long id, String name, String apiKey, boolean revoked, String createdAt) {
    }

    @PostMapping("/keys")
    public ApiResult<ApiKeyView> createKey(@RequestBody CreateKeyRequest request) {
        ApiKey key = apiKeyService.create(CurrentUser.id(), request.name());
        return ApiResult.ok(toView(key));
    }

    @GetMapping("/keys")
    public ApiResult<List<ApiKeyView>> listKeys() {
        return ApiResult.ok(apiKeyService.list(CurrentUser.id()).stream().map(OpenApiController::toView).toList());
    }

    @DeleteMapping("/keys/{id}")
    public ApiResult<Void> revokeKey(@PathVariable Long id) {
        apiKeyService.revoke(CurrentUser.id(), id);
        return ApiResult.ok(null);
    }

    /* ---------- Open API（X-Api-Key） ---------- */

    @GetMapping("/me")
    public ApiResult<Map<String, Object>> me(@RequestHeader(value = "X-Api-Key", required = false) String apiKey) {
        Long userId = apiKeyService.authenticate(apiKey);
        var user = userService.requireById(userId);
        return ApiResult.ok(Map.of(
                "userId", user.getId(),
                "username", user.getUsername(),
                "nickname", user.getNickname()));
    }

    @GetMapping("/messages")
    public ApiResult<List<MessageView>> messages(@RequestHeader(value = "X-Api-Key", required = false) String apiKey,
                                                 @RequestParam String conversationId,
                                                 @RequestParam(defaultValue = "20") int limit) {
        Long userId = apiKeyService.authenticate(apiKey);
        return ApiResult.ok(messageService.recent(userId, conversationId, limit));
    }

    @PostMapping("/messages")
    public ApiResult<SendResult> sendMessage(@RequestHeader(value = "X-Api-Key", required = false) String apiKey,
                                             @RequestBody SendMessageRequest request) {
        Long userId = apiKeyService.authenticate(apiKey);
        return ApiResult.ok(messageService.send(userId, request));
    }

    /* ---------- 内部 ---------- */

    private static ApiKeyView toView(ApiKey key) {
        return new ApiKeyView(key.getId(), key.getName(), key.getApiKey(), key.isRevoked(),
                key.getCreatedAt() == null ? null : key.getCreatedAt().toString());
    }
}
