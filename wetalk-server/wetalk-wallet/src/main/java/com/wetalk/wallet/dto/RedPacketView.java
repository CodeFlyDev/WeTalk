package com.wetalk.wallet.dto;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 红包详情视图：items 仅含已领取的份（未领金额不泄露，LUCKY 与微信一致）；
 * canGrab 由后端按「单聊仅对方可领 / 群聊成员均可领（含发送者）+ ACTIVE + 有剩余」判定。
 */
public record RedPacketView(
        String id,
        Long senderId,
        String senderName,
        String conversationId,
        long totalAmount,
        int count,
        String type,
        String greeting,
        String status,
        LocalDateTime expireAt,
        /** 我领取到的金额（分），未领为 null */
        Long receivedByMe,
        boolean canGrab,
        int remainCount,
        List<ItemView> items) {

    public record ItemView(int idx, long amount, Long receiverId, String receiverName, LocalDateTime receivedAt) {
    }
}
