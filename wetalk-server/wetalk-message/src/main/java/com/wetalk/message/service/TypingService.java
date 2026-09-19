package com.wetalk.message.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wetalk.common.BizException;
import com.wetalk.common.ErrorCode;
import com.wetalk.message.port.FriendPort;
import com.wetalk.message.port.GroupPort;
import com.wetalk.message.presence.PresenceService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 输入中状态：解析会话参与者并推送 TYPING notify（不落库、只推在线用户）。
 * conversationId 规则与消息一致：dm:{minId}:{maxId} / g:{groupId}。
 */
@Service
public class TypingService {

    private static final Logger log = LoggerFactory.getLogger(TypingService.class);

    public static final String QUEUE_NOTIFY = "/queue/notify";

    private final SimpMessagingTemplate messagingTemplate;
    private final PresenceService presenceService;
    private final GroupPort groupPort;
    private final FriendPort friendPort;
    private final ObjectMapper objectMapper;

    public TypingService(SimpMessagingTemplate messagingTemplate,
                         PresenceService presenceService,
                         GroupPort groupPort,
                         FriendPort friendPort,
                         ObjectMapper objectMapper) {
        this.messagingTemplate = messagingTemplate;
        this.presenceService = presenceService;
        this.groupPort = groupPort;
        this.friendPort = friendPort;
        this.objectMapper = objectMapper;
    }

    public void typing(Long senderId, String conversationId) {
        List<Long> recipients = resolveRecipients(senderId, conversationId);
        for (Long receiverId : recipients) {
            if (!presenceService.isOnline(receiverId)) {
                continue;
            }
            try {
                Map<String, Object> data = Map.of(
                        "conversationId", conversationId,
                        "senderId", senderId);
                Map<String, Object> body = new HashMap<>();
                body.put("event", "TYPING");
                body.put("data", data);
                messagingTemplate.convertAndSendToUser(
                        String.valueOf(receiverId), QUEUE_NOTIFY, objectMapper.writeValueAsString(body));
            } catch (JsonProcessingException e) {
                log.warn("typing notify serialize failed, conversation={}", conversationId, e);
            }
        }
    }

    /** 会话参与者校验（发起者必须身在会话中），返回需要通知的接收者 */
    private List<Long> resolveRecipients(Long senderId, String conversationId) {
        if (conversationId.startsWith("g:")) {
            long groupId = Long.parseLong(conversationId.substring(2));
            if (!groupPort.isMember(groupId, senderId)) {
                throw new BizException(ErrorCode.NOT_GROUP_MEMBER, "不是群成员");
            }
            return groupPort.memberIds(groupId).stream().filter(id -> !id.equals(senderId)).toList();
        }
        if (conversationId.startsWith("dm:")) {
            String[] parts = conversationId.substring(3).split(":");
            long a = Long.parseLong(parts[0]);
            long b = Long.parseLong(parts[1]);
            if (senderId != a && senderId != b) {
                throw new BizException(ErrorCode.FORBIDDEN, "无权访问该会话");
            }
            long peerId = senderId == a ? b : a;
            if (!friendPort.areFriends(senderId, peerId)) {
                return List.of();
            }
            return List.of(peerId);
        }
        throw new BizException(ErrorCode.BAD_REQUEST, "非法会话 ID");
    }
}
