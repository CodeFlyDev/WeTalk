package com.wetalk.message.ws;

import com.wetalk.auth.jwt.JwtTokenService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Map;

/**
 * WebSocket 握手鉴权：token 取自 query 参数 ?token= 或 Authorization 头。
 * 校验通过后把 userId 放入握手 attributes，供 HandshakeHandler 构造 Principal。
 */
@Component
public class JwtHandshakeInterceptor implements HandshakeInterceptor {

    private static final Logger log = LoggerFactory.getLogger(JwtHandshakeInterceptor.class);

    public static final String ATTR_USER_ID = "wsUserId";

    private final JwtTokenService jwtTokenService;

    public JwtHandshakeInterceptor(JwtTokenService jwtTokenService) {
        this.jwtTokenService = jwtTokenService;
    }

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                   WebSocketHandler wsHandler, Map<String, Object> attributes) {
        String token = null;
        if (request instanceof ServletServerHttpRequest servletRequest) {
            token = servletRequest.getServletRequest().getParameter("token");
            if (token == null || token.isBlank()) {
                String header = servletRequest.getServletRequest().getHeader("Authorization");
                if (header != null && header.startsWith("Bearer ")) {
                    token = header.substring(7);
                }
            }
        }
        var loginUser = token == null ? java.util.Optional.<com.wetalk.auth.security.LoginUser>empty()
                : jwtTokenService.parseAccess(token);
        if (loginUser.isEmpty()) {
            log.warn("ws handshake rejected: invalid token, uri={}", request.getURI());
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            return false;
        }
        attributes.put(ATTR_USER_ID, loginUser.get().userId());
        return true;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                               WebSocketHandler wsHandler, Exception exception) {
        // no-op
    }
}
