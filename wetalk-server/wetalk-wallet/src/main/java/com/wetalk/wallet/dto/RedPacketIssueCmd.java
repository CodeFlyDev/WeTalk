package com.wetalk.wallet.dto;

/**
 * 事务消息载荷：半消息 → 本地事务（扣款+建红包）→ 提交后由消费者写入会话。
 * receiverId / groupId 二选一（与 SendMessageRequest 语义一致）。
 */
public record RedPacketIssueCmd(
        String redPacketId,
        Long senderId,
        Long receiverId,
        Long groupId,
        String conversationId,
        long totalAmount,
        int count,
        String type,
        String greeting,
        String clientMsgId) {
}
