package com.wetalk.ai.config;

import io.minio.MinioClient;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * AI 服务自有 MinIO 客户端（拆分后不再复用 wetalk-file 的 bean）。
 */
@Configuration
public class AiMinioConfig {

    @Bean
    public MinioClient aiMinioClient(AiMinioProperties properties) {
        return MinioClient.builder()
                .endpoint(properties.getEndpoint())
                .credentials(properties.getAccessKey(), properties.getSecretKey())
                .build();
    }
}
