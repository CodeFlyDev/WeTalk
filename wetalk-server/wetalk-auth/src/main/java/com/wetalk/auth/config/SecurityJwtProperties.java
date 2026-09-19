package com.wetalk.auth.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * JWT 配置（application.yml · wetalk.jwt）
 * secret 必须不少于 32 字节（HS256）。
 */
@ConfigurationProperties(prefix = "wetalk.jwt")
public class SecurityJwtProperties {

    /** 签名密钥 */
    private String secret = "dev-jwt-secret-change-me-32bytes!!";

    /** access token 有效期（分钟） */
    private long accessExpireMinutes = 120;

    /** refresh token 有效期（天） */
    private long refreshExpireDays = 14;

    public String getSecret() {
        return secret;
    }

    public void setSecret(String secret) {
        this.secret = secret;
    }

    public long getAccessExpireMinutes() {
        return accessExpireMinutes;
    }

    public void setAccessExpireMinutes(long accessExpireMinutes) {
        this.accessExpireMinutes = accessExpireMinutes;
    }

    public long getRefreshExpireDays() {
        return refreshExpireDays;
    }

    public void setRefreshExpireDays(long refreshExpireDays) {
        this.refreshExpireDays = refreshExpireDays;
    }
}
