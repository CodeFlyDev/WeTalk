package com.wetalk.ai.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * AI 服务自有的 MinIO 只读配置（与 core 共用同一实例/桶，经独立客户端直读语音文件）。
 */
@ConfigurationProperties(prefix = "wetalk.minio")
public class AiMinioProperties {

    private String endpoint = "http://localhost:9000";
    private String accessKey = "minioadmin";
    private String secretKey = "minioadmin";
    private String bucket = "wetalk";

    public String getEndpoint() {
        return endpoint;
    }

    public void setEndpoint(String endpoint) {
        this.endpoint = endpoint;
    }

    public String getAccessKey() {
        return accessKey;
    }

    public void setAccessKey(String accessKey) {
        this.accessKey = accessKey;
    }

    public String getSecretKey() {
        return secretKey;
    }

    public void setSecretKey(String secretKey) {
        this.secretKey = secretKey;
    }

    public String getBucket() {
        return bucket;
    }

    public void setBucket(String bucket) {
        this.bucket = bucket;
    }
}
