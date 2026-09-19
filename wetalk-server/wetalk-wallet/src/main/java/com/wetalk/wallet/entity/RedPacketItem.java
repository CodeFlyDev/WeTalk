package com.wetalk.wallet.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.LocalDateTime;

/** 红包子份：发放时预拆分；receiverId 为 null 表示未领取。唯一约束防同一人重复领取 */
@Entity
@Table(name = "t_red_packet_item",
        uniqueConstraints = @UniqueConstraint(columnList = "redPacketId, receiverId"),
        indexes = {@Index(columnList = "redPacketId"), @Index(columnList = "receiverId")})
public class RedPacketItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String redPacketId;

    /** 第几份（0 起，抢红包按序取最小未领份） */
    private int idx;

    /** 本份金额（分） */
    private long amount;

    private Long receiverId;
    private LocalDateTime receivedAt;

    public Long getId() { return id; }
    public String getRedPacketId() { return redPacketId; }
    public void setRedPacketId(String redPacketId) { this.redPacketId = redPacketId; }
    public int getIdx() { return idx; }
    public void setIdx(int idx) { this.idx = idx; }
    public long getAmount() { return amount; }
    public void setAmount(long amount) { this.amount = amount; }
    public Long getReceiverId() { return receiverId; }
    public void setReceiverId(Long receiverId) { this.receiverId = receiverId; }
    public LocalDateTime getReceivedAt() { return receivedAt; }
    public void setReceivedAt(LocalDateTime receivedAt) { this.receivedAt = receivedAt; }
}
