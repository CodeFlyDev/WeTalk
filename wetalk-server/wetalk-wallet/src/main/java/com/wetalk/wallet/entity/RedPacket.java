package com.wetalk.wallet.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

/**
 * 红包：金额拆分在发放时预生成（ORDINARY 均分 / LUCKY 二倍均值随机）。
 * 状态机 ACTIVE（可抢）→ FINISHED（抢完）/ EXPIRED（24h 未抢完，余款退回）。
 */
@Entity
@Table(name = "t_red_packet", indexes = @Index(columnList = "senderId"))
public class RedPacket {

    public static final String TYPE_ORDINARY = "ORDINARY";
    public static final String TYPE_LUCKY = "LUCKY";

    public static final String STATUS_ACTIVE = "ACTIVE";
    public static final String STATUS_FINISHED = "FINISHED";
    public static final String STATUS_EXPIRED = "EXPIRED";

    /** 24 小时未抢完自动退回 */
    public static final java.time.Duration EXPIRE = java.time.Duration.ofHours(24);

    @Id
    private String id;

    private String conversationId;
    private Long senderId;

    /** 总金额（分） */
    private long totalAmount;

    private int count;

    /** ORDINARY / LUCKY */
    private String type;

    private String greeting;

    /** ACTIVE / FINISHED / EXPIRED */
    private String status;

    private LocalDateTime expireAt;
    private LocalDateTime createdAt;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getConversationId() { return conversationId; }
    public void setConversationId(String conversationId) { this.conversationId = conversationId; }
    public Long getSenderId() { return senderId; }
    public void setSenderId(Long senderId) { this.senderId = senderId; }
    public long getTotalAmount() { return totalAmount; }
    public void setTotalAmount(long totalAmount) { this.totalAmount = totalAmount; }
    public int getCount() { return count; }
    public void setCount(int count) { this.count = count; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getGreeting() { return greeting; }
    public void setGreeting(String greeting) { this.greeting = greeting; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDateTime getExpireAt() { return expireAt; }
    public void setExpireAt(LocalDateTime expireAt) { this.expireAt = expireAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
