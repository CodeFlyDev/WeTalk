package com.wetalk.voip.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

/**
 * 语音房间元数据（t_voice_room，JPA ddl-auto 自动建表）。
 * 房间在线成员由服务端内存记账（重启即散，成员重进自动重连），不落库。
 */
@Entity
@Table(name = "t_voice_room")
public class VoiceRoom {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "name", nullable = false, length = 20)
    private String name;

    @Column(name = "owner_id", nullable = false)
    private Long ownerId;

    /** 人数上限（mesh P2P 模式，默认 8） */
    @Column(name = "max_users", nullable = false)
    private Integer maxUsers = 8;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Long getOwnerId() {
        return ownerId;
    }

    public void setOwnerId(Long ownerId) {
        this.ownerId = ownerId;
    }

    public Integer getMaxUsers() {
        return maxUsers;
    }

    public void setMaxUsers(Integer maxUsers) {
        this.maxUsers = maxUsers;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
