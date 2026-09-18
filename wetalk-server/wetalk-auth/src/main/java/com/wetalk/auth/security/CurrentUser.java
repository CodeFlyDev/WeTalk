package com.wetalk.auth.security;

import com.wetalk.common.BizException;
import com.wetalk.common.ErrorCode;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * 当前登录用户读取工具（业务模块统一入口）
 */
public final class CurrentUser {

    private CurrentUser() {
    }

    public static LoginUser require() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof LoginUser loginUser) {
            return loginUser;
        }
        throw new BizException(ErrorCode.UNAUTHORIZED, "未登录或凭证已失效");
    }

    public static Long id() {
        return require().userId();
    }
}
