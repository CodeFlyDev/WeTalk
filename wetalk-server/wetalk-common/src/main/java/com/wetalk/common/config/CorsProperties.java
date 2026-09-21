package com.wetalk.common.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

/**
 * CORS 允许的来源配置（SecurityConfig 与 WebSocketConfig 共享同一来源）。
 */
@ConfigurationProperties(prefix = "wetalk.cors")
public record CorsProperties(List<String> allowedOrigins) {

    public static final String DEFAULT_LOCALHOST_5173 = "http://localhost:5173";
    public static final String DEFAULT_LOCALHOST_1420 = "http://localhost:1420";
    public static final String DEFAULT_TAURI = "tauri://localhost";

    public CorsProperties() {
        this(List.of(
                DEFAULT_LOCALHOST_5173,
                "http://127.0.0.1:5173",
                DEFAULT_LOCALHOST_1420,
                "http://127.0.0.1:1420",
                DEFAULT_TAURI));
    }

    public CorsProperties(List<String> allowedOrigins) {
        this.allowedOrigins = allowedOrigins == null || allowedOrigins.isEmpty()
                ? List.of(DEFAULT_LOCALHOST_5173, DEFAULT_LOCALHOST_1420, DEFAULT_TAURI)
                : List.copyOf(allowedOrigins);
    }

    /** WebSocketConfig 的 setAllowedOriginPatterns 需要 String[] */
    public String[] toArray() {
        return allowedOrigins.toArray(String[]::new);
    }
}
