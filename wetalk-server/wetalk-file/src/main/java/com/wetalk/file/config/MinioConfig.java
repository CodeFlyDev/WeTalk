package com.wetalk.file.config;

import io.minio.BucketExistsArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * MinIO 客户端 + 启动时确保媒体桶存在
 */
@Configuration
public class MinioConfig {

    private static final Logger log = LoggerFactory.getLogger(MinioConfig.class);

    @Bean
    public MinioClient minioClient(MinioProperties props) {
        MinioClient client = MinioClient.builder()
                .endpoint(props.getEndpoint())
                .credentials(props.getAccessKey(), props.getSecretKey())
                .build();
        try {
            boolean exists = client.bucketExists(BucketExistsArgs.builder().bucket(props.getBucket()).build());
            if (!exists) {
                client.makeBucket(MakeBucketArgs.builder().bucket(props.getBucket()).build());
                log.info("MinIO bucket created: {}", props.getBucket());
            }
        } catch (Exception e) {
            // 启动阶段 MinIO 不可用不阻断服务，首次上传时仍会再次探测
            log.warn("MinIO bucket check failed (will retry on demand): {}", e.getMessage());
        }
        return client;
    }
}
