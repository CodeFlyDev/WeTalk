package com.wetalk.message.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wetalk.message.document.MessageDoc;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

/**
 * 离线投递：对离线用户写 Kafka（wetalk.msg.offline），
 * 供后续多端推送/重试策略消费；P0 端侧上线后走离线补拉接口。
 */
@Service
public class OfflineEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(OfflineEventPublisher.class);

    public static final String TOPIC_OFFLINE = "wetalk.msg.offline";

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    public OfflineEventPublisher(KafkaTemplate<String, String> kafkaTemplate, ObjectMapper objectMapper) {
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = objectMapper;
    }

    public void publish(MessageDoc doc, Long receiverId) {
        try {
            Map<String, Object> event = new HashMap<>();
            event.put("messageId", doc.getId());
            event.put("conversationId", doc.getConversationId());
            event.put("senderId", doc.getSenderId());
            event.put("receiverId", receiverId);
            event.put("type", doc.getType() == null ? null : doc.getType().name());
            event.put("content", doc.getContent());
            event.put("refObjectKey", doc.getRefObjectKey());
            event.put("createdAt", doc.getCreatedAt() == null ? null : doc.getCreatedAt().toString());
            kafkaTemplate.send(TOPIC_OFFLINE, String.valueOf(receiverId), objectMapper.writeValueAsString(event));
        } catch (JsonProcessingException e) {
            log.error("offline event serialize failed, messageId={}", doc.getId(), e);
        }
    }
}
