package com.wetalk.voip.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wetalk.common.BizException;
import com.wetalk.common.ErrorCode;
import com.wetalk.message.presence.PresenceService;
import com.wetalk.voip.dto.VoipEvent;
import com.wetalk.voip.dto.VoipSignal;
import com.wetalk.voip.entity.VoiceRoom;
import com.wetalk.voip.repository.VoiceRoomRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 在线语音房间（mesh P2P，与群会议同一信令通道 /user/queue/voip）。
 *
 * 房间元数据落 MySQL（t_voice_room），在线成员由内存记账（重启即散，
 * 成员重进自动重连；转发时按 PresenceService 实时过滤离线成员防僵尸）。
 *
 * 信令流程：
 *   客户端 → /app/voip.room {roomId, callId, event}
 *     ROOM_JOIN  → 本人 ROOM_JOINED（payload = 在线成员 userId JSON 数组，
 *                  客户端据此向每个成员发起 Offer）+ 其他成员 ROOM_PEER_JOINED
 *     ROOM_LEAVE → 其他成员 ROOM_PEER_LEFT
 *     OFFER / ANSWER / ICE → 盖章转发给房间内其他在线成员
 * 房间语义与通话互斥由客户端保证（通话/会议进行中不允许进入房间）。
 */
@Service
public class VoiceRoomService {

    private static final Logger log = LoggerFactory.getLogger(VoiceRoomService.class);

    private final VoiceRoomRepository roomRepository;
    private final PresenceService presenceService;
    private final SimpMessagingTemplate messagingTemplate;
    private final ObjectMapper objectMapper;

    /** 房间在线成员记账：roomId → 加入顺序集合（保序，房主首个加入） */
    private final Map<Long, LinkedHashSet<Long>> roomMembers = new ConcurrentHashMap<>();

    public VoiceRoomService(VoiceRoomRepository roomRepository,
                            PresenceService presenceService,
                            SimpMessagingTemplate messagingTemplate,
                            ObjectMapper objectMapper) {
        this.roomRepository = roomRepository;
        this.presenceService = presenceService;
        this.messagingTemplate = messagingTemplate;
        this.objectMapper = objectMapper;
    }

    /** 房间信令入口（/app/voip.room） */
    public void handle(Long userId, VoipSignal signal) {
        if (signal.roomId() == null) {
            sendError(userId, signal, "缺少房间 id");
            return;
        }
        switch (signal.event()) {
            case ROOM_JOIN -> join(userId, signal);
            case ROOM_LEAVE -> leave(userId, signal.roomId(), true);
            case OFFER, ANSWER, ICE -> relayMedia(userId, signal);
            default -> sendError(userId, signal, "房间信令仅支持 JOIN/LEAVE/SDP/ICE");
        }
    }

    private void join(Long userId, VoipSignal signal) {
        Long roomId = signal.roomId();
        VoiceRoom room = requireRoom(roomId);

        LinkedHashSet<Long> members = roomMembers.computeIfAbsent(roomId, k -> new LinkedHashSet<>());
        synchronized (members) {
            if (!members.contains(userId) && members.size() >= room.getMaxUsers()) {
                sendError(userId, signal, "房间已满（上限 " + room.getMaxUsers() + " 人）");
                return;
            }
            members.add(userId);
        }

        // 回执本人：当前在线其他成员（客户端逐个发起 Offer，自己为 offer 发起方）
        List<Long> onlineOthers = onlineMembersOf(roomId, userId);
        sendToUser(userId, new VoipSignal(null, signal.callId(), VoipEvent.ROOM_JOINED,
                "AUDIO", null, jsonOf(onlineOthers), userId, roomId));

        // 广播其他在线成员：有新人加入
        VoipSignal peerJoined = new VoipSignal(null, signal.callId(), VoipEvent.ROOM_PEER_JOINED,
                "AUDIO", null, String.valueOf(userId), userId, roomId);
        for (Long memberId : onlineOthers) {
            sendToUser(memberId, peerJoined);
        }
        log.debug("voice room join, room={}, user={}, online={}", roomId, userId, onlineOthers.size() + 1);
    }

    private void leave(Long userId, Long roomId, boolean notifySelf) {
        LinkedHashSet<Long> members = roomMembers.get(roomId);
        if (members != null) {
            synchronized (members) {
                members.remove(userId);
            }
        }
        if (notifySelf) {
            // 回执本人离开成功（客户端清理本地状态）
            sendToUser(userId, new VoipSignal(null, "room-" + roomId, VoipEvent.ROOM_PEER_LEFT,
                    "AUDIO", null, String.valueOf(userId), userId, roomId));
        }
        // 广播剩余在线成员
        VoipSignal peerLeft = new VoipSignal(null, "room-" + roomId, VoipEvent.ROOM_PEER_LEFT,
                "AUDIO", null, String.valueOf(userId), userId, roomId);
        for (Long memberId : onlineMembersOf(roomId, userId)) {
            sendToUser(memberId, peerLeft);
        }
        log.debug("voice room leave, room={}, user={}", roomId, userId);
    }

    /** OFFER / ANSWER / ICE：盖章转发给房间内其他在线成员（房间内免校验好友关系） */
    private void relayMedia(Long userId, VoipSignal signal) {
        if (!isMember(userId, signal.roomId())) {
            sendError(userId, signal, "未加入房间，无法发送媒体信令");
            return;
        }
        VoipSignal out = new VoipSignal(null, signal.callId(), signal.event(),
                signal.media(), null, signal.payload(), userId, signal.roomId());
        for (Long memberId : onlineMembersOf(signal.roomId(), userId)) {
            sendToUser(memberId, out);
        }
    }

    /** 用户断线/换房时由客户端主动 leave；成员集合仅为记账，转发时实时过滤离线 */
    private boolean isMember(Long userId, Long roomId) {
        Set<Long> members = roomMembers.get(roomId);
        return members != null && members.contains(userId);
    }

    private List<Long> onlineMembersOf(Long roomId, Long excludeUserId) {
        Set<Long> members = roomMembers.get(roomId);
        if (members == null) {
            return List.of();
        }
        List<Long> online = new ArrayList<>();
        synchronized (members) {
            for (Long memberId : members) {
                if (!memberId.equals(excludeUserId) && presenceService.isOnline(memberId)) {
                    online.add(memberId);
                }
            }
        }
        return online;
    }

    /** 房间在线人数（REST 列表用） */
    public int onlineCount(Long roomId) {
        return onlineMembersOf(roomId, -1L).size();
    }

    /** 用户所在房间（无则 null）——客户端刷新页面恢复状态用 */
    public Long roomOf(Long userId) {
        for (Map.Entry<Long, LinkedHashSet<Long>> entry : roomMembers.entrySet()) {
            if (entry.getValue().contains(userId)) {
                return entry.getKey();
            }
        }
        return null;
    }

    private VoiceRoom requireRoom(Long roomId) {
        return roomRepository.findById(roomId)
                .orElseThrow(() -> new BizException(ErrorCode.NOT_FOUND, "房间不存在: " + roomId));
    }

    private String jsonOf(List<Long> userIds) {
        try {
            return objectMapper.writeValueAsString(userIds);
        } catch (Exception e) {
            return "[]";
        }
    }

    private void sendError(Long userId, VoipSignal signal, String reason) {
        sendToUser(userId, new VoipSignal(null, signal.callId(), VoipEvent.ERROR,
                signal.media(), null, reason, userId, signal.roomId()));
    }

    private void sendToUser(Long userId, VoipSignal signal) {
        try {
            messagingTemplate.convertAndSendToUser(String.valueOf(userId), VoipSignalingService.QUEUE_VOIP, signal);
        } catch (Exception e) {
            log.warn("voice room push failed, event={}, to={}", signal.event(), userId, e);
        }
    }
}
