package com.wetalk.voip.service;

import com.wetalk.message.port.FriendPort;
import com.wetalk.message.port.GroupPort;
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
 * 点对点流程：INVITE → (ACCEPT → OFFER → ANSWER → ICE…) → END / REJECT / CANCEL。
 * 群会议（mesh P2P）：MEET_JOIN / MEET_LEAVE 携带 groupId，
 * 服务端校验群成员后转发给群内其他在线成员（无房间记账，OFFER/ANSWER/ICE 仍按
 * 会议 callId + groupId 广播，客户端按 fromUserId 归属到对应 PeerConnection）。
 */
@Service
public class VoipSignalingService {

    private static final Logger log = LoggerFactory.getLogger(VoipSignalingService.class);

    /** 客户端订阅 /user/queue/voip 接收信令 */
    public static final String QUEUE_VOIP = "/queue/voip";

    private final SimpMessagingTemplate messagingTemplate;
    private final PresenceService presenceService;
    private final FriendPort friendPort;
    private final GroupPort groupPort;
    private final org.springframework.context.ApplicationEventPublisher eventPublisher;

    public VoipSignalingService(SimpMessagingTemplate messagingTemplate,
                                PresenceService presenceService,
                                FriendPort friendPort,
                                GroupPort groupPort,
                                org.springframework.context.ApplicationEventPublisher eventPublisher) {
        this.messagingTemplate = messagingTemplate;
        this.presenceService = presenceService;
        this.friendPort = friendPort;
        this.groupPort = groupPort;
        this.eventPublisher = eventPublisher;
    }

    public void relay(Long fromUserId, VoipSignal signal) {
        // 群会议广播：MEET_JOIN / MEET_LEAVE 等携带 groupId 的信令走会议分支
        if (signal.groupId() != null) {
            relayMeeting(fromUserId, signal);
            return;
        }

        if (signal.peerId() == null) {
            sendToUser(fromUserId, errorOf(signal, "缺少信令目标"));
            return;
        }
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

        // fromUserId 以服务端解析为准，防止伪造他人身份；groupId/roomId 强制清空防串扰
        VoipSignal out = new VoipSignal(signal.peerId(), signal.callId(), signal.event(),
                signal.media(), null, signal.payload(), fromUserId, null);
        sendToUser(signal.peerId(), out);
        // 通话发起成就（ach 侧幂等）
        if (signal.event() == VoipEvent.INVITE) {
            eventPublisher.publishEvent(new com.wetalk.common.AchieveEvent(fromUserId,
                    "VIDEO".equals(signal.media()) ? "FIRST_VIDEO" : "FIRST_VOICE"));
        }
    }

    /** 群会议信令：校验群成员后转发给群内其他在线成员（mesh 无房间记账） */
    private void relayMeeting(Long fromUserId, VoipSignal signal) {
        if (signal.event() != VoipEvent.MEET_JOIN && signal.event() != VoipEvent.MEET_LEAVE
                && signal.event() != VoipEvent.OFFER && signal.event() != VoipEvent.ANSWER
                && signal.event() != VoipEvent.ICE) {
            sendToUser(fromUserId, errorOf(signal, "会议信令仅支持 JOIN/LEAVE/SDP/ICE"));
            return;
        }
        if (!groupPort.isMember(signal.groupId(), fromUserId)) {
            sendToUser(fromUserId, errorOf(signal, "仅群成员可参与会议"));
            return;
        }

        // fromUserId 服务端盖章，peerId/roomId 清空（广播语义），groupId 保留
        VoipSignal out = new VoipSignal(null, signal.callId(), signal.event(),
                signal.media(), signal.groupId(), signal.payload(), fromUserId, null);
        int sent = 0;
        for (Long memberId : groupPort.memberIds(signal.groupId())) {
            if (memberId.equals(fromUserId) || !presenceService.isOnline(memberId)) {
                continue;
            }
            sendToUser(memberId, out);
            sent++;
        }
        log.debug("voip meeting relay, event={}, group={}, from={}, sent={}",
                signal.event(), signal.groupId(), fromUserId, sent);
    }

    private static VoipSignal offlineOf(VoipSignal signal) {
        // fromUserId=对端 ID：客户端统一按「信令来源」处理
        return new VoipSignal(signal.peerId(), signal.callId(), VoipEvent.OFFLINE,
                signal.media(), null, null, signal.peerId(), null);
    }

    private static VoipSignal errorOf(VoipSignal signal, String reason) {
        return new VoipSignal(signal.peerId(), signal.callId(), VoipEvent.ERROR,
                signal.media(), null, reason, signal.peerId(), null);
    }

    private void sendToUser(Long userId, VoipSignal signal) {
        try {
            messagingTemplate.convertAndSendToUser(String.valueOf(userId), QUEUE_VOIP, signal);
        } catch (Exception e) {
            log.warn("voip signal push failed, event={}, to={}", signal.event(), userId, e);
        }
    }
}
