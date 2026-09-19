package com.wetalk.message.dto;

import java.time.LocalDateTime;

/**
 * 群文件视图：由群会话内 type=FILE 消息聚合而来
 */
public record GroupFileView(
        String messageId,
        Long senderId,
        String fileName,
        String objectKey,
        LocalDateTime createdAt) {
}
