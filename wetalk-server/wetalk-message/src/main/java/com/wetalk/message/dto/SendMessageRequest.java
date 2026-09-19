package com.wetalk.message.dto;

import com.wetalk.common.MessageType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * 发送消息请求：单聊填 receiverId，群聊填 groupId（二选一）
 */
public record SendMessageRequest(
        Long receiverId,
        Long groupId,
        @NotNull(message = "消息类型不能为空") MessageType type,
        @Size(max = 4096, message = "内容最长 4096 字符") String content,
        @Size(max = 512) String refObjectKey,
        @Size(max = 64) String clientMsgId,
        @Size(max = 64) String replyToId,
        @Size(max = 100, message = "提及人数过多") List<Long> mentionedUserIds,
        /** 阅后即焚（可选，默认关闭） */
        Boolean burnAfterRead) {

    public boolean isGroupMessage() {
        return groupId != null;
    }
}
