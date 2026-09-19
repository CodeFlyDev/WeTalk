package com.wetalk.auth.security;

import com.wetalk.common.BizException;
import com.wetalk.common.ErrorCode;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

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

    /** 原始 access token（去掉 Bearer 前缀；跨服务调用透传用，无 token 返回 null） */
    public static String token() {
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attrs) {
            String header = attrs.getRequest().getHeader("Authorization");
            return header == null ? null : header.replaceFirst("^Bearer ", "");
        }
        return null;
    }
}
