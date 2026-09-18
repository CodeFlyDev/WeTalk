package com.wetalk.voip.service;

import com.wetalk.message.port.FriendPort;
import com.wetalk.message.presence.PresenceService;
import com.wetalk.voip.dto.VoipEvent;
import com.wetalk.voip.dto.VoipSignal;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

/**
 * 通话信令转发（有状态媒体由端到端 WebRTC 承载，服务端只转发信令；
 * TURN/STUN 由 coturn 提供，见 docker-compose）。
 *
 * 通道约定：客户端 → /app/voip.signal；服务端 → /user/queue/voip。
 * 呼叫流程：INVITE → (ACCEPT → OFFER → ANSWER → ICE…) → END / REJECT / CANCEL。
 */
@Service
public class VoipSignalingService {

    private static final Logger log = LoggerFactory.getLogger(VoipSignalingService.class);

    /** 客户端订阅 /user/queue/voip 接收信令 */
    public static final String QUEUE_VOIP = "/queue/voip";

    private final SimpMessagingTemplate messagingTemplate;
    private final PresenceService presenceService;
    private final FriendPort friendPort;

    public VoipSignalingService(SimpMessagingTemplate messagingTemplate,
                                PresenceService presenceService,
                                FriendPort friendPort) {
        this.messagingTemplate = messagingTemplate;
        this.presenceService = presenceService;
        this.friendPort = friendPort;
    }

    public void relay(Long fromUserId, VoipSignal signal) {
        if (!friendPort.areFriends(fromUserId, signal.peerId())) {
            // STOMP 通道内异常不便于统一回执，直接回 ERROR 信令
            sendToUser(fromUserId, errorOf(signal, "仅好友之间可发起通话"));
            return;
        }

        // 对端离线：仅对 INVITE 明确回执 OFFLINE，其余事件静默丢弃
        if (!presenceService.isOnline(signal.peerId())) {
            if (signal.event() == VoipEvent.INVITE) {
                sendToUser(fromUserId, offlineOf(signal));
            }
            log.debug("voip peer offline, event={}, caller={}, callee={}",
                    signal.event(), fromUserId, signal.peerId());
            return;
        }

        // fromUserId 以服务端解析为准，防止伪造他人身份
        VoipSignal out = new VoipSignal(signal.peerId(), signal.callId(), signal.event(),
                signal.media(), signal.payload(), fromUserId);
        sendToUser(signal.peerId(), out);
    }

    private static VoipSignal offlineOf(VoipSignal signal) {
        // fromUserId=对端 ID：客户端统一按「信令来源」处理
        return new VoipSignal(signal.peerId(), signal.callId(), VoipEvent.OFFLINE,
                signal.media(), null, signal.peerId());
    }

    private static VoipSignal errorOf(VoipSignal signal, String reason) {
        return new VoipSignal(signal.peerId(), signal.callId(), VoipEvent.ERROR,
                signal.media(), reason, signal.peerId());
    }

    private void sendToUser(Long userId, VoipSignal signal) {
        try {
            messagingTemplate.convertAndSendToUser(String.valueOf(userId), QUEUE_VOIP, signal);
        } catch (Exception e) {
            log.warn("voip signal push failed, event={}, to={}", signal.event(), userId, e);
        }
    }
}
