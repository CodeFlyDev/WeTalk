package com.wetalk.message.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wetalk.common.BizException;
import com.wetalk.common.ErrorCode;
import com.wetalk.message.dto.WhiteboardRequest;
import com.wetalk.message.document.WhiteboardDoc;
import com.wetalk.message.port.FriendPort;
import com.wetalk.message.port.GroupPort;
import com.wetalk.message.presence.PresenceService;
import com.wetalk.message.repository.WhiteboardRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 协作白板：笔画 append-only 存 MongoDB，实时经 /user/queue/notify 推 WHITEBOARD 事件给会话其他在线成员。
 * 权限与消息一致（dm 双方 / 群成员）；笔画坐标由前端归一化，跨端尺寸自适应。
 */
@Service
public class WhiteboardService {

    private static final Logger log = LoggerFactory.getLogger(WhiteboardService.class);

    public static final String EVENT_STROKE = "STROKE";
    public static final String EVENT_CLEAR = "CLEAR";

    /** 单板笔画上限（超出后拒绝新增，前端提示清空） */
    private static final int MAX_STROKES = 5000;

    private final WhiteboardRepository repository;
    private final MessageService messageService;
    private final SimpMessagingTemplate messagingTemplate;
    private final PresenceService presenceService;
    private final FriendPort friendPort;
    private final GroupPort groupPort;
    private final ObjectMapper objectMapper;

    public WhiteboardService(WhiteboardRepository repository,
                             MessageService messageService,
                             SimpMessagingTemplate messagingTemplate,
                             PresenceService presenceService,
                             FriendPort friendPort,
                             GroupPort groupPort,
                             ObjectMapper objectMapper) {
        this.repository = repository;
        this.messageService = messageService;
        this.messagingTemplate = messagingTemplate;
        this.presenceService = presenceService;
        this.friendPort = friendPort;
        this.groupPort = groupPort;
        this.objectMapper = objectMapper;
    }

    /** 白板历史（进入时全量回放，按笔画顺序） */
    public List<String> history(Long userId, String conversationId) {
        messageService.assertParticipant(userId, conversationId);
        return repository.findById(conversationId).map(WhiteboardDoc::getStrokes).orElse(List.of());
    }

    /** 应用一笔操作：持久化 + 推送给会话其他在线成员 */
    public void apply(Long userId, WhiteboardRequest request) {
        if (!EVENT_STROKE.equals(request.event()) && !EVENT_CLEAR.equals(request.event())) {
            throw new BizException(ErrorCode.BAD_REQUEST, "非法白板事件");
        }
        messageService.assertParticipant(userId, request.conversationId());

        WhiteboardDoc doc = repository.findById(request.conversationId()).orElseGet(() -> {
            WhiteboardDoc fresh = new WhiteboardDoc();
            fresh.setId(request.conversationId());
            return fresh;
        });
        if (EVENT_STROKE.equals(request.event())) {
            if (doc.getStrokes().size() >= MAX_STROKES) {
                throw new BizException(ErrorCode.BIZ_ERROR, "白板笔画已达上限，请先清空");
            }
            doc.getStrokes().add(request.data());
        } else {
            doc.getStrokes().clear();
        }
        doc.setUpdatedAt(LocalDateTime.now());
        repository.save(doc);

        for (Long receiverId : recipientsOf(userId, request.conversationId())) {
            if (!presenceService.isOnline(receiverId)) {
                continue;
            }
            try {
                Map<String, Object> data = new HashMap<>();
                data.put("conversationId", request.conversationId());
                data.put("event", request.event());
                data.put("stroke", request.data());
                data.put("fromUserId", userId);
                Map<String, Object> body = new HashMap<>();
                body.put("event", "WHITEBOARD");
                body.put("data", data);
                messagingTemplate.convertAndSendToUser(
                        String.valueOf(receiverId), TypingService.QUEUE_NOTIFY, objectMapper.writeValueAsString(body));
            } catch (JsonProcessingException e) {
                log.warn("whiteboard notify serialize failed, conversation={}", request.conversationId(), e);
            }
        }
    }

    /** 会话其他参与者（与 TypingService 一致：dm 校验好友，群校验成员） */
    private List<Long> recipientsOf(Long senderId, String conversationId) {
        if (conversationId.startsWith("g:")) {
            long groupId = Long.parseLong(conversationId.substring(2));
            if (!groupPort.isMember(groupId, senderId)) {
                throw new BizException(ErrorCode.NOT_GROUP_MEMBER, "不是群成员");
            }
            return groupPort.memberIds(groupId).stream().filter(id -> !id.equals(senderId)).toList();
        }
        if (conversationId.startsWith("dm:")) {
            String[] parts = conversationId.substring(3).split(":");
            long a = Long.parseLong(parts[0]);
            long b = Long.parseLong(parts[1]);
            if (senderId != a && senderId != b) {
                throw new BizException(ErrorCode.FORBIDDEN, "无权访问该会话");
            }
            return List.of(senderId == a ? b : a);
        }
        throw new BizException(ErrorCode.BAD_REQUEST, "非法会话 ID");
    }
}
