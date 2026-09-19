package com.wetalk.open.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wetalk.common.BizException;
import com.wetalk.common.ErrorCode;
import com.wetalk.common.WebhookEvent;
import com.wetalk.open.entity.Webhook;
import com.wetalk.open.repository.WebhookRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;

/**
 * Webhook 管理 + 事件推送：MESSAGE_CREATED 事件监听 → 推给「单聊接收方」配置的回调。
 * 虚拟线程异步推送（3s 超时、失败静默不重试），不阻塞消息主链路；群消息广播量不可控不推送。
 */
@Service
public class WebhookService {

    private static final Logger log = LoggerFactory.getLogger(WebhookService.class);
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String EVENT_MESSAGE_CREATED = "MESSAGE_CREATED";

    private final WebhookRepository webhookRepository;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(3))
            .build();

    public WebhookService(WebhookRepository webhookRepository, ObjectMapper objectMapper) {
        this.webhookRepository = webhookRepository;
        this.objectMapper = objectMapper;
    }

    public Webhook create(Long userId, String url) {
        if (url == null || !url.startsWith("http")) {
            throw new BizException(ErrorCode.BAD_REQUEST, "Webhook 地址需以 http(s) 开头");
        }
        Webhook hook = new Webhook();
        hook.setUserId(userId);
        hook.setUrl(url.trim());
        hook.setSecret(randomSecret());
        hook.setCreatedAt(LocalDateTime.now());
        return webhookRepository.save(hook);
    }

    public List<Webhook> list(Long userId) {
        return webhookRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    public void delete(Long userId, Long id) {
        Webhook hook = webhookRepository.findById(id)
                .orElseThrow(() -> new BizException(ErrorCode.NOT_FOUND, "Webhook 不存在"));
        if (!hook.getUserId().equals(userId)) {
            throw new BizException(ErrorCode.FORBIDDEN, "无权操作该 Webhook");
        }
        webhookRepository.delete(hook);
    }

    /** 消息事件入口（Spring 应用事件，同步返回、虚拟线程异步推送） */
    @org.springframework.context.event.EventListener
    public void onMessageCreated(WebhookEvent event) {
        // 仅推送单聊接收方（群消息广播量不可控；sender 的 webhook 也不推，避免回声）
        if (event.receiverId() == null) {
            return;
        }
        List<Webhook> hooks = webhookRepository.findByUserIdAndActiveTrue(event.receiverId());
        if (hooks.isEmpty()) {
            return;
        }
        Map<String, Object> payload = Map.of(
                "event", EVENT_MESSAGE_CREATED,
                "messageId", event.messageId(),
                "conversationId", event.conversationId(),
                "senderId", event.senderId(),
                "type", event.type(),
                "content", event.content() == null ? "" : event.content(),
                "createdAt", event.createdAt().toString());
        for (Webhook hook : hooks) {
            Thread.ofVirtual().start(() -> push(hook, payload));
        }
    }

    private void push(Webhook hook, Map<String, Object> payload) {
        try {
            String body = objectMapper.writeValueAsString(payload);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(hook.getUrl()))
                    .timeout(Duration.ofSeconds(3))
                    .header("Content-Type", "application/json")
                    .header("X-WeTalk-Event", EVENT_MESSAGE_CREATED)
                    .header("X-WeTalk-Signature", hmacSha256(hook.getSecret(), body))
                    .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                    .build();
            httpClient.send(request, HttpResponse.BodyHandlers.discarding());
        } catch (Exception e) {
            log.debug("webhook push failed, url={}", hook.getUrl(), e);
        }
    }

    private static String hmacSha256(String secret, String body) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(body.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            return "";
        }
    }

    private static String randomSecret() {
        byte[] bytes = new byte[24];
        RANDOM.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }
}
