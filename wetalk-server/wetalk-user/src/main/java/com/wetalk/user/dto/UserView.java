package com.wetalk.user.dto;

/**
 * 用户视图（不含凭证字段）
 */
public record UserView(Long id, String username, String nickname, String avatarUrl) {
}
