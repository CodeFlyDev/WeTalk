package com.wetalk.voip.ws;

import com.wetalk.voip.dto.VoipSignal;
import com.wetalk.voip.service.VoipSignalingService;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Controller;

import java.security.Principal;

/**
 * 通话/语音房间信令入口（STOMP），Principal name = userId。
 * /app/voip.signal → 点对点通话与群会议；/app/voip.room → 在线语音房间。
 */
@Controller
public class VoipSignalingController {

    private final VoipSignalingService signalingService;
    private final com.wetalk.voip.service.VoiceRoomService voiceRoomService;

    public VoipSignalingController(VoipSignalingService signalingService,
                                   com.wetalk.voip.service.VoiceRoomService voiceRoomService) {
        this.signalingService = signalingService;
        this.voiceRoomService = voiceRoomService;
    }

    @MessageMapping("/voip.signal")
    public void signal(@Payload VoipSignal signal, Principal principal) {
        Long userId = Long.parseLong(principal.getName());
        signalingService.relay(userId, signal);
    }

    @MessageMapping("/voip.room")
    public void room(@Payload VoipSignal signal, Principal principal) {
        Long userId = Long.parseLong(principal.getName());
        voiceRoomService.handle(userId, signal);
    }
}
