package com.wetalk.voip.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

/**
 * 通话信令载荷：客户端发送 /app/voip.signal，服务端补 fromUserId 后转发。
 * 点对点信令填 peerId → 转发到对端 /user/queue/voip；
 * 群会议广播（MEET_JOIN / MEET_LEAVE）填 groupId → 广播给群内其他在线成员；
 * 语音房间（ROOM_JOIN / ROOM_LEAVE / OFFER / ANSWER / ICE）填 roomId → 由 VoiceRoomService 处理。
 * payload 透传 SDP / ICE 候选 JSON。
 */
public record VoipSignal(
        /** 点对点信令目标（会议广播时为空） */
        Long peerId,
        @NotBlank(message = "callId 不能为空") @Size(max = 64) String callId,
        @NotNull(message = "信令事件不能为空") VoipEvent event,
        /** AUDIO / VIDEO（INVITE 携带） */
        @Size(max = 16) String media,
        /** 会议广播目标群（仅 MEET_JOIN / MEET_LEAVE 等会议信令携带） */
        @Positive Long groupId,
        @Size(max = 32768, message = "信令载荷过大") String payload,
        /** 服务端填充：信令来源用户 ID（客户端传入值被忽略） */
        Long fromUserId,
        /** 语音房间 id（仅房间信令携带；客户端传入值被忽略，服务端按 URL 路径/载荷原样透传） */
        @Positive Long roomId) {
}
