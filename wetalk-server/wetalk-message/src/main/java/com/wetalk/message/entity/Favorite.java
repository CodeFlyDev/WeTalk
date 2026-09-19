package com.wetalk.message.entity;

import com.wetalk.common.MessageType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.LocalDateTime;

/**
 * 消息收藏（按用户维度存消息副本，原消息删除/撤回不影响收藏记录）
 */
@Entity
@Table(name = "t_favorite", uniqueConstraints = @UniqueConstraint(
        name = "uk_favorite_user_message", columnNames = {"user_id", "message_id"}))
public class Favorite {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "message_id", nullable = false, length = 64)
    private String messageId;

    @Column(name = "conversation_id", nullable = false, length = 64)
    private String conversationId;

    @Column(name = "sender_id", nullable = false)
    private Long senderId;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 32)
    private MessageType type;

    /** 文本内容 / 文件名 / 时长秒数（与 MessageDoc.content 一致） */
    @Column(name = "content", length = 2048)
    private String content;

    @Column(name = "ref_object_key", length = 512)
    private String refObjectKey;

    /** 收藏时间 */
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public String getMessageId() {
        return messageId;
    }

    public void setMessageId(String messageId) {
        this.messageId = messageId;
    }

    public String getConversationId() {
        return conversationId;
    }

    public void setConversationId(String conversationId) {
        this.conversationId = conversationId;
    }

    public Long getSenderId() {
        return senderId;
    }

    public void setSenderId(Long senderId) {
        this.senderId = senderId;
    }

    public MessageType getType() {
        return type;
    }

    public void setType(MessageType type) {
        this.type = type;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getRefObjectKey() {
        return refObjectKey;
    }

    public void setRefObjectKey(String refObjectKey) {
        this.refObjectKey = refObjectKey;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
