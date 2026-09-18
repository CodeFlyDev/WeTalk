package com.wetalk.voip.ws;

import com.wetalk.voip.dto.VoipSignal;
import com.wetalk.voip.service.VoipSignalingService;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Controller;

import java.security.Principal;

/**
 * 通话信令入口：/app/voip.signal（STOMP），Principal name = userId。
 */
@Controller
public class VoipSignalingController {

    private final VoipSignalingService signalingService;

    public VoipSignalingController(VoipSignalingService signalingService) {
        this.signalingService = signalingService;
    }

    @MessageMapping("/voip.signal")
    public void signal(@Payload VoipSignal signal, Principal principal) {
        Long userId = Long.parseLong(principal.getName());
        signalingService.relay(userId, signal);
    }
}
