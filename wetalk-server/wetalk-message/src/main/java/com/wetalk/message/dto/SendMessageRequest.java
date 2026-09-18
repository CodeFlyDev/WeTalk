package com.wetalk.message.dto;

import com.wetalk.common.MessageType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 发送消息请求：单聊填 receiverId，群聊填 groupId（二选一）
 */
public record SendMessageRequest(
        Long receiverId,
        Long groupId,
        @NotNull(message = "消息类型不能为空") MessageType type,
        @Size(max = 4096, message = "内容最长 4096 字符") String content,
        @Size(max = 512) String refObjectKey,
        @Size(max = 64) String clientMsgId) {

    public boolean isGroupMessage() {
        return groupId != null;
    }
}
