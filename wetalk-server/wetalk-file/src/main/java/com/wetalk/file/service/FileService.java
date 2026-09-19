package com.wetalk.file.service;

import com.wetalk.common.BizException;
import com.wetalk.common.ErrorCode;
import com.wetalk.file.config.MinioProperties;
import com.wetalk.file.dto.PresignResult;
import io.minio.GetPresignedObjectUrlArgs;
import io.minio.http.Method;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * 媒体上传：presigned URL 直传（HTTP 分流，WebSocket 只传 objectKey 引用，对齐 Task.md）
 * objectKey 规则：{yyyyMM}/{uuid}-{安全化文件名}
 */
@Service
public class FileService {

    private static final Logger log = LoggerFactory.getLogger(FileService.class);

    private static final DateTimeFormatter MONTH_DIR = DateTimeFormatter.ofPattern("yyyyMM");

    /** MinIO presigned URL 最大有效期 7 天 */
    private static final int MAX_PRESIGN_SECONDS = 604800;

    private final io.minio.MinioClient minioClient;
    private final MinioProperties props;

    public FileService(io.minio.MinioClient minioClient, MinioProperties props) {
        this.minioClient = minioClient;
        this.props = props;
    }

    public PresignResult presignUpload(String fileName, String contentType) {
        String objectKey = buildObjectKey(fileName);
        try {
            String uploadUrl = minioClient.getPresignedObjectUrl(GetPresignedObjectUrlArgs.builder()
                    .method(Method.PUT)
                    .bucket(props.getBucket())
                    .object(objectKey)
                    .expiry((int) Math.min(props.getUploadExpireSeconds(), MAX_PRESIGN_SECONDS), TimeUnit.SECONDS)
                    .build());
            return new PresignResult(objectKey, uploadUrl, props.getUploadExpireSeconds());
        } catch (Exception e) {
            log.error("presign upload failed, fileName={}", fileName, e);
            throw new BizException(ErrorCode.SYSTEM_ERROR, "生成上传地址失败");
        }
    }

    /** 私有桶读取：签发 GET 下载地址 */
    public String presignDownload(String objectKey) {
        validateObjectKey(objectKey);
        try {
            return minioClient.getPresignedObjectUrl(GetPresignedObjectUrlArgs.builder()
                    .method(Method.GET)
                    .bucket(props.getBucket())
                    .object(objectKey)
                    .expiry((int) Math.min(props.getDownloadExpireSeconds(), MAX_PRESIGN_SECONDS), TimeUnit.SECONDS)
                    .build());
        } catch (Exception e) {
            log.error("presign download failed, objectKey={}", objectKey, e);
            throw new BizException(ErrorCode.NOT_FOUND, "文件不存在或已过期");
        }
    }

    private String buildObjectKey(String fileName) {
        String safe = fileName.replaceAll("[\\\\/:*?\"<>|\\s]", "_");
        if (safe.length() > 128) {
            safe = safe.substring(safe.length() - 128);
        }
        return LocalDate.now().format(MONTH_DIR) + "/" + UUID.randomUUID() + "-" + safe;
    }

    /** 防路径穿越：只允许字母数字、下划线、连字符、点、斜杠 */
    private void validateObjectKey(String objectKey) {
        if (objectKey == null || objectKey.contains("..")
                || !objectKey.matches("^[a-zA-Z0-9_\\-./]{1,512}$")) {
            throw new BizException(ErrorCode.BAD_REQUEST, "objectKey 非法");
        }
    }
}
