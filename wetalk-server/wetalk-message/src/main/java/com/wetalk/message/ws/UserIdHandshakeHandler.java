package com.wetalk.message.ws;

import org.springframework.http.server.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.support.DefaultHandshakeHandler;

import java.security.Principal;
import java.util.Map;

/**
 * 以 userId 作为 STOMP Principal（name=userId），
 * 使 convertAndSendToUser(userId, ...) 与客户端订阅 /user/queue/... 对齐。
 */
@Component
public class UserIdHandshakeHandler extends DefaultHandshakeHandler {

    @Override
    protected Principal determineUser(ServerHttpRequest request, WebSocketHandler wsHandler,
                                      Map<String, Object> attributes) {
        Object userId = attributes.get(JwtHandshakeInterceptor.ATTR_USER_ID);
        return () -> String.valueOf(userId);
    }
}
