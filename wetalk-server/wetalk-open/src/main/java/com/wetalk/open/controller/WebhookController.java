package com.wetalk.open.controller;

import com.wetalk.auth.security.CurrentUser;
import com.wetalk.common.ApiResult;
import com.wetalk.open.entity.Webhook;
import com.wetalk.open.service.WebhookService;
import jakarta.validation.constraints.NotBlank;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Webhook 管理（JWT）：注册回调地址，MESSAGE_CREATED 事件自动推送 */
@RestController
@RequestMapping("/api/open/webhooks")
public class WebhookController {

    private final WebhookService webhookService;

    public WebhookController(WebhookService webhookService) {
        this.webhookService = webhookService;
    }

    public record CreateWebhookRequest(@NotBlank String url) {
    }

    public record WebhookView(Long id, String url, String secret, boolean active, String createdAt) {
    }

    @PostMapping
    public ApiResult<WebhookView> create(@RequestBody CreateWebhookRequest request) {
        return ApiResult.ok(toView(webhookService.create(CurrentUser.id(), request.url())));
    }

    @GetMapping
    public ApiResult<List<WebhookView>> list() {
        return ApiResult.ok(webhookService.list(CurrentUser.id()).stream().map(WebhookController::toView).toList());
    }

    @DeleteMapping("/{id}")
    public ApiResult<Void> delete(@PathVariable Long id) {
        webhookService.delete(CurrentUser.id(), id);
        return ApiResult.ok(null);
    }

    private static WebhookView toView(Webhook hook) {
        return new WebhookView(hook.getId(), hook.getUrl(), hook.getSecret(), hook.isActive(),
                hook.getCreatedAt() == null ? null : hook.getCreatedAt().toString());
    }
}
