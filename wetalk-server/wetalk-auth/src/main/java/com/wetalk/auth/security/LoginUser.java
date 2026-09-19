package com.wetalk.auth.security;

/**
 * 已登录用户（认证成功后的 Principal）
 */
public record LoginUser(Long userId, String username) {
}
