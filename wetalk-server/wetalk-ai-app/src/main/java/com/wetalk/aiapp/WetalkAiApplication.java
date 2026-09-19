package com.wetalk.aiapp;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.data.elasticsearch.repository.config.EnableElasticsearchRepositories;

/**
 * AI 域独立启动入口（wetalk-ai-svc）。
 * 只扫描 ai 域与 auth 安全基座（SecurityConfig/JwtTokenService/CurrentUser），
 * 不扫 auth 的 AuthService/user 域 —— 那属于 core 服务。
 */
@SpringBootApplication(scanBasePackages = {
        "com.wetalk.ai",
        "com.wetalk.auth.security",
        "com.wetalk.auth.jwt",
        "com.wetalk.auth.config"})
@ConfigurationPropertiesScan({"com.wetalk.ai", "com.wetalk.auth.config"})
@EnableElasticsearchRepositories(basePackages = "com.wetalk.ai.search")
public class WetalkAiApplication {

    public static void main(String[] args) {
        SpringApplication.run(WetalkAiApplication.class, args);
    }
}
