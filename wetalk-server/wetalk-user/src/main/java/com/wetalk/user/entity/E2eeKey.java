package com.wetalk.user.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

/**
 * E2EE 公钥（每用户一把 ECDH P-256 公钥，JWK 序列化；私钥仅存客户端本机，服务端不感知）
 */
@Entity
@Table(name = "t_e2ee_key")
public class E2eeKey {

    @Id
    @Column(name = "user_id")
    private Long userId;

    /** 公钥 JWK（JSON 字符串，约 300 字符） */
    @Column(name = "public_key_jwk", nullable = false, columnDefinition = "TEXT")
    private String publicKeyJwk;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public String getPublicKeyJwk() {
        return publicKeyJwk;
    }

    public void setPublicKeyJwk(String publicKeyJwk) {
        this.publicKeyJwk = publicKeyJwk;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
