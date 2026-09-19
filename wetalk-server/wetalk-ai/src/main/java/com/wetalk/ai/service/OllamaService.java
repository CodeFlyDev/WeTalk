package com.wetalk.ai.service;

import com.wetalk.ai.config.AiProperties;
import com.wetalk.common.BizException;
import com.wetalk.common.ErrorCode;
import com.wetalk.common.MessageType;
import com.wetalk.message.dto.MessageView;
import com.wetalk.message.service.MessageService;
import com.wetalk.user.entity.UserAccount;
import com.wetalk.user.service.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.List;

/**
 * 本地 LLM（Ollama /api/chat，非流式起步）：
 * - AI 助手对话：客户端携带历史，服务端裁剪后转发
 * - 聊天摘要：校验参与者 → 取最近消息拼 prompt → 生成要点
 */
@Service
public class OllamaService {

    private static final Logger log = LoggerFactory.getLogger(OllamaService.class);

    /** 助手人设 */
    private static final String CHAT_SYSTEM_PROMPT =
            "你是 WeTalk 内置的 AI 助手，用中文简洁、友好地回答用户的问题。";

    /** 摘要上下文条数与单条截断长度（避免 prompt 过长拖垮本地小模型） */
    private static final int SUMMARY_MESSAGE_LIMIT = 50;
    private static final int SUMMARY_SNIPPET_LENGTH = 200;

    private final MessageService messageService;
    private final UserService userService;
    private final AiProperties aiProperties;
    private final RestClient restClient;

    public OllamaService(MessageService messageService,
                         UserService userService,
                         AiProperties aiProperties) {
        this.messageService = messageService;
        this.userService = userService;
        this.aiProperties = aiProperties;
        // 本地 LLM 生成较慢：连接 5s / 读取 120s（前端 axios 同步 120s）
        var factory = new org.springframework.http.client.SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5000);
        factory.setReadTimeout(120000);
        this.restClient = RestClient.builder()
                .baseUrl(aiProperties.getOllamaUrl())
                .requestFactory(factory)
                .build();
    }

    /** 对话消息（role: system / user / assistant） */
    public record ChatMessage(String role, String content) {
    }

    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper =
            new com.fasterxml.jackson.databind.ObjectMapper();

    /**
     * AI 助手对话：history 为客户端最近若干轮（旧→新），服务端裁剪到最近 20 条。
     * knowledgeContext 非空时注入知识库资料（RAG）。
     */
    public String chat(List<ChatMessage> history, String message, String knowledgeContext) {
        List<ChatMessage> messages = new ArrayList<>();
        messages.add(new ChatMessage("system", CHAT_SYSTEM_PROMPT));
        if (knowledgeContext != null && !knowledgeContext.isBlank()) {
            messages.add(new ChatMessage("system",
                    "以下是知识库中与问题相关的资料，回答时优先参考：\n" + knowledgeContext));
        }
        if (history != null) {
            history.stream()
                    .filter(m -> m != null && m.content() != null && !m.content().isBlank())
                    .filter(m -> "user".equals(m.role()) || "assistant".equals(m.role()))
                    .toList()
                    .reversed()
                    .stream()
                    .limit(20)
                    .toList()
                    .reversed()
                    .forEach(messages::add);
        }
        messages.add(new ChatMessage("user", message));
        return complete(messages);
    }

    /**
     * 聊天摘要：仅会话参与者可调用，取最近 50 条有效消息拼接后生成要点。
     */
    public String summarize(Long userId, String conversationId) {
        List<MessageView> recent = messageService.recent(userId, conversationId, SUMMARY_MESSAGE_LIMIT);
        if (recent.isEmpty()) {
            throw new BizException(ErrorCode.BIZ_ERROR, "该会话暂无可摘要的消息");
        }
        StringBuilder sb = new StringBuilder("请用中文总结以下即时通讯对话的要点（关键结论、待办事项），150 字以内：\n\n");
        for (MessageView m : recent) {
            if (m.recalled() || m.type() != MessageType.TEXT || m.content() == null || m.content().isBlank()) {
                continue;
            }
            sb.append(senderName(m.senderId())).append("：")
                    .append(m.content(), 0, Math.min(m.content().length(), SUMMARY_SNIPPET_LENGTH))
                    .append('\n');
        }
        return complete(List.of(new ChatMessage("user", sb.toString())));
    }

    /** 表情包文案（text = 中文文案，tag = 英文情绪词） */
    public record StickerText(String text, String tag) {
    }

    /**
     * 表情包文案生成：LLM 输出 JSON（宽容解析，失败降级直接用主题做文案）。
     * 图像由前端 canvas 模板合成（本地 Ollama 无文生图能力）。
     */
    public StickerText sticker(String prompt) {
        String instruction = "为表情包生成文案。主题：" + prompt
                + "。只返回 JSON，格式：{\"text\":\"不超过12字的中文搞笑文案\",\"tag\":\"英文情绪词(happy/angry/cry/cool/love 中选一个)\"}";
        String raw = complete(List.of(new ChatMessage("user", instruction)));
        try {
            int start = raw.indexOf('{');
            int end = raw.lastIndexOf('}');
            if (start >= 0 && end > start) {
                var node = objectMapper.readTree(raw.substring(start, end + 1));
                String text = node.path("text").asText("");
                String tag = node.path("tag").asText("happy");
                if (!text.isBlank()) {
                    return new StickerText(text.length() > 20 ? text.substring(0, 20) : text, tag);
                }
            }
        } catch (Exception e) {
            log.warn("sticker json parse failed, fallback to prompt", e);
        }
        return new StickerText(prompt.length() > 20 ? prompt.substring(0, 20) : prompt, "happy");
    }

    private String senderName(Long senderId) {
        try {
            UserAccount user = userService.requireById(senderId);
            return user.getNickname() == null || user.getNickname().isBlank()
                    ? user.getUsername() : user.getNickname();
        } catch (Exception e) {
            return "用户" + senderId;
        }
    }

    private String complete(List<ChatMessage> messages) {
        try {
            String resp = restClient.post()
                    .uri("/api/chat")
                    .body(java.util.Map.of(
                            "model", aiProperties.getOllamaModel(),
                            "messages", messages,
                            "stream", false))
                    .retrieve()
                    .body(String.class);
            var node = objectMapper.readTree(resp == null ? "{}" : resp);
            String content = node.path("message").path("content").asText("");
            if (content.isBlank()) {
                throw new BizException(ErrorCode.SYSTEM_ERROR, "AI 未返回内容，请稍后重试");
            }
            return content;
        } catch (BizException e) {
            throw e;
        } catch (Exception e) {
            log.error("ollama chat failed, model={}", aiProperties.getOllamaModel(), e);
            throw new BizException(ErrorCode.SYSTEM_ERROR, "AI 服务暂不可用，请确认 Ollama 已启动并已拉取模型");
        }
    }
}
