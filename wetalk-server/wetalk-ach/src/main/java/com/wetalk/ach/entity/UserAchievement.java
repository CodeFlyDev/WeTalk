package com.wetalk.ach.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.LocalDateTime;

/**
 * 用户成就（t_user_achievement）：user_id + code 唯一，首次解锁时间即获得时间。
 */
@Entity
@Table(name = "t_user_achievement",
        uniqueConstraints = @UniqueConstraint(name = "uk_ach_user_code", columnNames = {"user_id", "code"}),
        indexes = @jakarta.persistence.Index(name = "idx_ach_user", columnList = "user_id"))
public class UserAchievement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "code", nullable = false, length = 32)
    private String code;

    @Column(name = "unlocked_at", nullable = false, updatable = false)
    private LocalDateTime unlockedAt;

    @PrePersist
    void onCreate() {
        this.unlockedAt = LocalDateTime.now();
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

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public LocalDateTime getUnlockedAt() {
        return unlockedAt;
    }
}
