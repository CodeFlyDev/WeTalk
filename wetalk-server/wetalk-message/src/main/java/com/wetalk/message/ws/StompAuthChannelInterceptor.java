package com.wetalk.message.ws;

import com.wetalk.auth.jwt.JwtTokenService;
import com.wetalk.common.security.LoginUser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * STOMP CONNECT 帧鉴权：从 STOMP CONNECT 帧的 Authorization 头提取 JWT，
 * 校验后设置 Principal（name=userId），使 convertAndSendToUser 对齐 /user/queue/...。
 * 握手阶段不再放行 token via URL query，token 仅在 STOMP 帧中传递。
 */
@Component
public class StompAuthChannelInterceptor implements ChannelInterceptor {

    private static final Logger log = LoggerFactory.getLogger(StompAuthChannelInterceptor.class);

    private final JwtTokenService jwtTokenService;

    public StompAuthChannelInterceptor(JwtTokenService jwtTokenService) {
        this.jwtTokenService = jwtTokenService;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor
                .getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null || !StompCommand.CONNECT.equals(accessor.getCommand())) {
            return message;
        }

        String authHeader = accessor.getFirstNativeHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            log.warn("stomp CONNECT rejected: missing Authorization header");
            return null; // reject the CONNECT frame
        }

        String token = authHeader.substring(7);
        var loginUser = jwtTokenService.parseAccess(token);
        if (loginUser.isEmpty()) {
            log.warn("stomp CONNECT rejected: invalid token");
            return null;
        }

        LoginUser user = loginUser.get();
        // 设置 Principal，使 STOMP session 的 user 解析为 userId
        accessor.setUser(new UsernamePasswordAuthenticationToken(
                user, null, List.of(new SimpleGrantedAuthority("ROLE_USER"))));
        log.debug("stomp CONNECT authenticated, userId={}", user.userId());
        return message;
    }
}
