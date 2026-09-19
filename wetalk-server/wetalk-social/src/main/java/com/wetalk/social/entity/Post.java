package com.wetalk.social.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

/**
 * 动态（t_post）：文字 + 图片（MinIO objectKey 逗号分隔，最多 9 张）
 */
@Entity
@Table(name = "t_post", indexes = @Index(name = "idx_post_user", columnList = "user_id"))
public class Post {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "content", nullable = false, length = 2048)
    private String content;

    /** 图片 objectKey 逗号分隔（空串 = 无图） */
    @Column(name = "image_keys", length = 2048)
    private String imageKeys = "";

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

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getImageKeys() {
        return imageKeys;
    }

    public void setImageKeys(String imageKeys) {
        this.imageKeys = imageKeys;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
