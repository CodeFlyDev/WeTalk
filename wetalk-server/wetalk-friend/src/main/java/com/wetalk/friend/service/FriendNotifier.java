package com.wetalk.friend.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wetalk.friend.entity.FriendRequest;
import com.wetalk.message.presence.PresenceService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

/**
 * 好友事件在线通知：推送到 /user/{id}/queue/notify（STOMP Broker 由 message 模块启用）
 */
@Service
public class FriendNotifier {

    private static final Logger log = LoggerFactory.getLogger(FriendNotifier.class);

    public static final String QUEUE_NOTIFY = "/queue/notify";

    private final SimpMessagingTemplate messagingTemplate;
    private final PresenceService presenceService;
    private final ObjectMapper objectMapper;

    public FriendNotifier(SimpMessagingTemplate messagingTemplate,
                          PresenceService presenceService,
                          ObjectMapper objectMapper) {
        this.messagingTemplate = messagingTemplate;
        this.presenceService = presenceService;
        this.objectMapper = objectMapper;
    }

    public void notifyFriendRequest(FriendRequest request) {
        send(request.getToUserId(), "FRIEND_REQUEST", Map.of(
                "requestId", request.getId(),
                "fromUserId", request.getFromUserId(),
                "remark", request.getRemark() == null ? "" : request.getRemark()));
    }

    public void notifyFriendAccepted(FriendRequest request) {
        send(request.getFromUserId(), "FRIEND_ACCEPTED", Map.of(
                "requestId", request.getId(),
                "acceptedBy", request.getToUserId()));
    }

    private void send(Long receiverId, String event, Map<String, Object> payload) {
        if (!presenceService.isOnline(receiverId)) {
            return;
        }
        try {
            Map<String, Object> body = new HashMap<>();
            body.put("event", event);
            body.put("data", payload);
            messagingTemplate.convertAndSendToUser(
                    String.valueOf(receiverId), QUEUE_NOTIFY, objectMapper.writeValueAsString(body));
        } catch (JsonProcessingException e) {
            log.error("friend notify serialize failed, event={}", event, e);
        }
    }
}
