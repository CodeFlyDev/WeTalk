package com.wetalk.message.ws;

import com.wetalk.message.dto.SendMessageRequest;
import com.wetalk.message.dto.SendResult;
import com.wetalk.message.dto.TypingRequest;
import com.wetalk.message.dto.WhiteboardRequest;
import com.wetalk.message.presence.PresenceService;
import com.wetalk.message.service.MessageService;
import com.wetalk.message.service.TypingService;
import com.wetalk.message.service.WhiteboardService;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.annotation.SendToUser;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.security.Principal;

/**
 * STOMP 会话事件：上线写 Redis 在线表、心跳续期、断线移除；
 * 通道内发送消息与 REST /api/messages 走同一 MessageService。
 */
@Component
public class WsEventListener {

    private final PresenceService presenceService;
    private final MessageService messageService;
    private final TypingService typingService;
    private final WhiteboardService whiteboardService;

    public WsEventListener(PresenceService presenceService, MessageService messageService,
                           TypingService typingService, WhiteboardService whiteboardService) {
        this.presenceService = presenceService;
        this.messageService = messageService;
        this.typingService = typingService;
        this.whiteboardService = whiteboardService;
    }

    @EventListener
    public void onConnect(SessionConnectEvent event) {
        Long userId = userId(event);
        if (userId != null) {
            presenceService.online(userId, StompHeaderAccessor.wrap(event.getMessage()).getSessionId());
        }
    }

    @EventListener
    public void onDisconnect(SessionDisconnectEvent event) {
        Long userId = userId(event);
        if (userId != null) {
            presenceService.offline(userId, event.getSessionId());
        }
    }

    /** 客户端定期发送 /app/heartbeat 续期在线状态 */
    @MessageMapping("/heartbeat")
    public void heartbeat(Principal principal) {
        parseUserId(principal).ifPresent(presenceService::refresh);
    }

    /** 通道内发送消息，回执 /user/queue/ack */
    @MessageMapping("/chat.send")
    @SendToUser("/queue/ack")
    public SendResult send(SendMessageRequest request, Principal principal) {
        Long userId = parseUserId(principal).orElseThrow();
        return messageService.send(userId, request);
    }

    /** 输入中状态上报：推送 TYPING notify 给会话其他参与者（不落库） */
    @MessageMapping("/typing")
    public void typing(TypingRequest request, Principal principal) {
        parseUserId(principal).ifPresent(userId -> typingService.typing(userId, request.conversationId()));
    }

    /** 协作白板笔画上报：持久化 + 推 WHITEBOARD notify 给会话其他在线成员 */
    @MessageMapping("/whiteboard")
    public void whiteboard(WhiteboardRequest request, Principal principal) {
        parseUserId(principal).ifPresent(userId -> whiteboardService.apply(userId, request));
    }

    private Long userId(org.springframework.context.ApplicationEvent event) {
        Principal principal = switch (event) {
            case SessionConnectEvent connect -> connect.getUser();
            case SessionDisconnectEvent disconnect -> disconnect.getUser();
            default -> null;
        };
        return parseUserId(principal).orElse(null);
    }

    private java.util.Optional<Long> parseUserId(Principal principal) {
        try {
            return principal == null ? java.util.Optional.empty()
                    : java.util.Optional.of(Long.parseLong(principal.getName()));
        } catch (NumberFormatException e) {
            return java.util.Optional.empty();
        }
    }
}
