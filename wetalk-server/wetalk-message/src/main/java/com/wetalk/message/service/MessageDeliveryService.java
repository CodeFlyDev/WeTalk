package com.wetalk.message.service;

import com.wetalk.message.document.MessageDoc;
import com.wetalk.message.dto.MessageView;
import com.wetalk.message.port.GroupPort;
import com.wetalk.message.presence.PresenceService;
import com.wetalk.message.presence.UnreadService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 消息投递：在线走 WebSocket 推送，离线写未读计数 + Kafka 离线事件。
 * 对齐 Task.md · 实时通信链路。
 */
@Service
public class MessageDeliveryService {

    private static final Logger log = LoggerFactory.getLogger(MessageDeliveryService.class);

    /** 客户端订阅 /user/queue/messages 接收新消息 */
    public static final String QUEUE_MESSAGES = "/queue/messages";

    private final SimpMessagingTemplate messagingTemplate;
    private final PresenceService presenceService;
    private final UnreadService unreadService;
    private final OfflineEventPublisher offlineEventPublisher;
    private final GroupPort groupPort;

    public MessageDeliveryService(SimpMessagingTemplate messagingTemplate,
                                  PresenceService presenceService,
                                  UnreadService unreadService,
                                  OfflineEventPublisher offlineEventPublisher,
                                  GroupPort groupPort) {
        this.messagingTemplate = messagingTemplate;
        this.presenceService = presenceService;
        this.unreadService = unreadService;
        this.offlineEventPublisher = offlineEventPublisher;
        this.groupPort = groupPort;
    }

    public void deliver(MessageDoc doc, List<Long> recipients) {
        for (Long receiverId : recipients) {
            if (presenceService.isOnline(receiverId)) {
                try {
                    messagingTemplate.convertAndSendToUser(
                            String.valueOf(receiverId), QUEUE_MESSAGES, toView(doc));
                } catch (Exception e) {
                    // 推送失败降级为离线链路，保证不丢消息
                    log.warn("ws push failed, fallback to offline, messageId={}, receiver={}",
                            doc.getId(), receiverId, e);
                    deliverOffline(doc, receiverId);
                }
            } else {
                deliverOffline(doc, receiverId);
            }
        }
    }

    private void deliverOffline(MessageDoc doc, Long receiverId) {
        unreadService.increment(doc.getConversationId(), receiverId);
        offlineEventPublisher.publish(doc, receiverId);
    }

    public static MessageView toView(MessageDoc doc) {
        return new MessageView(doc.getId(), doc.getConversationId(), doc.getSenderId(),
                doc.getReceiverId(), doc.getGroupId(), doc.getType(), doc.getContent(),
                doc.getRefObjectKey(), doc.getClientMsgId(), doc.getCreatedAt());
    }
}
