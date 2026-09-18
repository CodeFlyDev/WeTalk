package com.wetalk.voip.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 通话信令载荷：客户端发送 /app/voip.signal，服务端补 fromUserId 后转发到对端 /user/queue/voip。
 * payload 透传 SDP / ICE 候选 JSON。
 */
public record VoipSignal(
        @NotNull(message = "对端用户不能为空") Long peerId,
        @NotBlank(message = "callId 不能为空") @Size(max = 64) String callId,
        @NotNull(message = "信令事件不能为空") VoipEvent event,
        /** AUDIO / VIDEO（INVITE 携带） */
        @Size(max = 16) String media,
        @Size(max = 32768, message = "信令载荷过大") String payload,
        /** 服务端填充：信令来源用户 ID（客户端传入值被忽略） */
        Long fromUserId) {
}
