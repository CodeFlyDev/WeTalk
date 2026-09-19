package com.wetalk.wallet.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

/**
 * 事务消息本地事务日志：与「扣余额 + 建红包」同一 MySQL 事务写入。
 * 事务回查依据：记录存在 → 本地事务已提交（COMMIT）；不存在 → ROLLBACK。
 * SENT 由消费者在消息成功入会话后回写，同时作为投递幂等标记。
 */
@Entity
@Table(name = "t_red_packet_tx_log")
public class RedPacketTxLog {

    public static final String PREPARED = "PREPARED";
    public static final String SENT = "SENT";

    /** 红包 ID */
    @Id
    private String txKey;

    /** PREPARED / SENT */
    private String status;

    private LocalDateTime createdAt;

    public String getTxKey() { return txKey; }
    public void setTxKey(String txKey) { this.txKey = txKey; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
