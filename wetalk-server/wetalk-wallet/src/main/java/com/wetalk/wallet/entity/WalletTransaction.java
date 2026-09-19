package com.wetalk.wallet.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

/** 钱包流水：amount 恒为正数，方向由 type 语义表达（SEND/REFUND 为出账，RECV/RECHARGE 为入账） */
@Entity
@Table(name = "t_wallet_tx", indexes = @Index(columnList = "userId,createdAt"))
public class WalletTransaction {

    public static final String RECHARGE = "RECHARGE";
    public static final String RED_PACKET_SEND = "RED_PACKET_SEND";
    public static final String RED_PACKET_RECV = "RED_PACKET_RECV";
    public static final String RED_PACKET_REFUND = "RED_PACKET_REFUND";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long userId;

    /** RECHARGE / RED_PACKET_SEND / RED_PACKET_RECV / RED_PACKET_REFUND */
    private String type;

    /** 金额（分，正数） */
    private long amount;

    /** 关联业务 ID（红包 ID / 充值单号） */
    private String refId;

    private String remark;
    private LocalDateTime createdAt;

    public static WalletTransaction of(Long userId, String type, long amount, String refId, String remark) {
        WalletTransaction tx = new WalletTransaction();
        tx.userId = userId;
        tx.type = type;
        tx.amount = amount;
        tx.refId = refId;
        tx.remark = remark;
        tx.createdAt = LocalDateTime.now();
        return tx;
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public String getType() { return type; }
    public long getAmount() { return amount; }
    public String getRefId() { return refId; }
    public String getRemark() { return remark; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
