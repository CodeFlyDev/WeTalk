package com.wetalk.common.security;

import java.security.Principal;

/**
 * 已登录用户（认证成功后的 Principal）。
 * 实现 Principal 使 STOMP session 的 user name = userId，
 * 从而让 convertAndSendToUser(userId, /user/queue/...) 与 principal.getName() 对齐。
 */
public record LoginUser(Long userId, String username) implements Principal {
    @Override
    public String getName() {
        return String.valueOf(userId);
    }
}
