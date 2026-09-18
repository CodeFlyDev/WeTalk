package com.wetalk.message.ws;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * STOMP over WebSocket：端点 /ws（token 握手鉴权），Broker 前缀 /queue、/topic，用户前缀 /user。
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final JwtHandshakeInterceptor jwtHandshakeInterceptor;
    private final UserIdHandshakeHandler userIdHandshakeHandler;

    public WebSocketConfig(JwtHandshakeInterceptor jwtHandshakeInterceptor,
                           UserIdHandshakeHandler userIdHandshakeHandler) {
        this.jwtHandshakeInterceptor = jwtHandshakeInterceptor;
        this.userIdHandshakeHandler = userIdHandshakeHandler;
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // 原生 WebSocket
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*")
                .addInterceptors(jwtHandshakeInterceptor)
                .setHandshakeHandler(userIdHandshakeHandler);
        // SockJS 回退（浏览器兼容模式）
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*")
                .addInterceptors(jwtHandshakeInterceptor)
                .setHandshakeHandler(userIdHandshakeHandler)
                .withSockJS();
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/queue", "/topic");
        registry.setUserDestinationPrefix("/user");
        registry.setApplicationDestinationPrefixes("/app");
    }
}
