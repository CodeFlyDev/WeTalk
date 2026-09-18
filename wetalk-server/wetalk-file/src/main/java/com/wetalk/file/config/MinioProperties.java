package com.wetalk.file.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * MinIO 配置（application.yml · wetalk.minio）
 */
@ConfigurationProperties(prefix = "wetalk.minio")
public class MinioProperties {

    private String endpoint = "http://localhost:9000";
    private String accessKey = "";
    private String secretKey = "";
    /** 媒体桶名 */
    private String bucket = "wetalk";
    /** presigned PUT 有效期（秒） */
    private long uploadExpireSeconds = 900;
    /** presigned GET 有效期（秒） */
    private long downloadExpireSeconds = 1800;

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

    public long getUploadExpireSeconds() {
        return uploadExpireSeconds;
    }

    public void setUploadExpireSeconds(long uploadExpireSeconds) {
        this.uploadExpireSeconds = uploadExpireSeconds;
    }

    public long getDownloadExpireSeconds() {
        return downloadExpireSeconds;
    }

    public void setDownloadExpireSeconds(long downloadExpireSeconds) {
        this.downloadExpireSeconds = downloadExpireSeconds;
    }
}
