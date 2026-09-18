package com.wetalk.message.service;

import com.wetalk.common.BizException;
import com.wetalk.common.ErrorCode;
import com.wetalk.common.MessageType;
import com.wetalk.message.document.MessageDoc;
import com.wetalk.message.dto.MessageView;
import com.wetalk.message.dto.SendMessageRequest;
import com.wetalk.message.dto.SendResult;
import com.wetalk.message.port.FriendPort;
import com.wetalk.message.port.GroupPort;
import com.wetalk.message.presence.UnreadService;
import com.wetalk.message.repository.MessageRepository;
import com.wetalk.message.util.ConversationIds;
import com.wetalk.user.service.UserService;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

/**
 * 消息领域服务：发送（校验 → MongoDB 持久化 → 在线推送/离线投递）、历史补拉、未读。
 */
@Service
public class MessageService {

    /** 客户端可直接发送的消息类型白名单（SYSTEM/RECALL/READ_ACK/TYPING/CALL_* 由服务端或信令通道产生） */
    private static final Set<MessageType> CLIENT_SENDABLE = EnumSet.of(
            MessageType.TEXT, MessageType.IMAGE, MessageType.FILE, MessageType.VOICE,
            MessageType.VIDEO, MessageType.EMOJI, MessageType.LOCATION, MessageType.CARD);

    /** 撤回时间窗：发送后 2 分钟内可撤回 */
    private static final java.time.Duration RECALL_WINDOW = java.time.Duration.ofMinutes(2);

    private final MessageRepository messageRepository;
    private final UserService userService;
    private final FriendPort friendPort;
    private final GroupPort groupPort;
    private final MessageDeliveryService deliveryService;
    private final UnreadService unreadService;

    public MessageService(MessageRepository messageRepository,
                          UserService userService,
                          FriendPort friendPort,
                          GroupPort groupPort,
                          MessageDeliveryService deliveryService,
                          UnreadService unreadService) {
        this.messageRepository = messageRepository;
        this.userService = userService;
        this.friendPort = friendPort;
        this.groupPort = groupPort;
        this.deliveryService = deliveryService;
        this.unreadService = unreadService;
    }

    public SendResult send(Long senderId, SendMessageRequest request) {
        validate(request);

        MessageDoc doc = new MessageDoc();
        doc.setSenderId(senderId);
        doc.setType(request.type());
        doc.setContent(request.content());
        doc.setRefObjectKey(request.refObjectKey());
        doc.setClientMsgId(request.clientMsgId());
        doc.setReplyToId(request.replyToId());
        doc.setMentionedUserIds(request.mentionedUserIds() == null ? List.of() : request.mentionedUserIds());
        doc.setCreatedAt(LocalDateTime.now());

        List<Long> recipients;
        if (request.isGroupMessage()) {
            if (!groupPort.isMember(request.groupId(), senderId)) {
                throw new BizException(ErrorCode.NOT_GROUP_MEMBER, "不是群成员，无法发送");
            }
            doc.setGroupId(request.groupId());
            doc.setConversationId(ConversationIds.group(request.groupId()));
            recipients = groupPort.memberIds(request.groupId()).stream()
                    .filter(id -> !id.equals(senderId))
                    .toList();
        } else {
            if (!userService.existsById(request.receiverId())) {
                throw new BizException(ErrorCode.USER_NOT_FOUND, "接收用户不存在");
            }
            if (!friendPort.areFriends(senderId, request.receiverId())) {
                throw new BizException(ErrorCode.NOT_FRIENDS, "仅好友之间可发送单聊消息");
            }
            doc.setReceiverId(request.receiverId());
            doc.setConversationId(ConversationIds.directMessage(senderId, request.receiverId()));
            recipients = List.of(request.receiverId());
        }

        // 幂等：同会话内 clientMsgId 重复直接返回既有消息
        if (request.clientMsgId() != null) {
            var existing = messageRepository
                    .findFirstByConversationIdAndClientMsgIdOrderByCreatedAtDesc(
                            doc.getConversationId(), request.clientMsgId());
            if (existing.isPresent()) {
                return toResult(existing.get());
            }
        }

        // 引用校验：原消息必须存在且属于同一会话
        if (request.replyToId() != null && !request.replyToId().isBlank()) {
            MessageDoc origin = messageRepository.findById(request.replyToId())
                    .orElseThrow(() -> new BizException(ErrorCode.NOT_FOUND, "引用的原消息不存在"));
            if (!origin.getConversationId().equals(doc.getConversationId())) {
                throw new BizException(ErrorCode.BAD_REQUEST, "只能引用同一会话内的消息");
            }
        }

        messageRepository.save(doc);
        deliveryService.deliver(doc, recipients);
        return toResult(doc);
    }

    /**
     * 撤回：仅发送者本人、2 分钟内、未撤回过。
     * 成功后向在线接收方推送 RECALL 事件（离线方补拉历史时看到 recalled=true 占位）。
     */
    public MessageView recall(Long userId, String messageId) {
        MessageDoc doc = messageRepository.findById(messageId)
                .orElseThrow(() -> new BizException(ErrorCode.NOT_FOUND, "消息不存在"));
        if (!doc.getSenderId().equals(userId)) {
            throw new BizException(ErrorCode.FORBIDDEN, "只能撤回自己发送的消息");
        }
        if (doc.isRecalled()) {
            throw new BizException(ErrorCode.BIZ_ERROR, "消息已撤回");
        }
        if (doc.getCreatedAt().isBefore(LocalDateTime.now().minus(RECALL_WINDOW))) {
            throw new BizException(ErrorCode.BIZ_ERROR, "超过可撤回时间（2 分钟）");
        }
        doc.setRecalled(true);
        doc.setRecalledAt(LocalDateTime.now());
        messageRepository.save(doc);

        List<Long> recipients = doc.getGroupId() != null
                ? groupPort.memberIds(doc.getGroupId()).stream().filter(id -> !id.equals(userId)).toList()
                : List.of(doc.getReceiverId());
        deliveryService.deliverRecall(MessageDeliveryService.toView(doc), recipients);
        return MessageDeliveryService.toView(doc);
    }

    /** 按 ID 查询单条消息（引用条回显），校验请求者是会话参与者 */
    public MessageView get(Long userId, String messageId) {
        MessageDoc doc = messageRepository.findById(messageId)
                .orElseThrow(() -> new BizException(ErrorCode.NOT_FOUND, "消息不存在"));
        boolean participant;
        if (doc.getGroupId() != null) {
            participant = groupPort.isMember(doc.getGroupId(), userId);
        } else {
            participant = doc.getSenderId().equals(userId) || userId.equals(doc.getReceiverId());
        }
        if (!participant) {
            throw new BizException(ErrorCode.FORBIDDEN, "无权查看该消息");
        }
        return MessageDeliveryService.toView(doc);
    }

    /** 离线补拉：按会话向前翻页（返回升序） */
    public List<MessageView> history(String conversationId, LocalDateTime before, int limit) {
        int size = limit <= 0 ? 20 : Math.min(limit, 50);
        List<MessageDoc> docs = before == null
                ? messageRepository.findTop50ByConversationIdOrderByCreatedAtDesc(conversationId)
                : messageRepository.findTop50ByConversationIdAndCreatedAtLessThanOrderByCreatedAtDesc(
                        conversationId, before);
        return docs.stream()
                .limit(size)
                .map(MessageDeliveryService::toView)
                .toList()
                .reversed();
    }

    public java.util.Map<String, Long> unread(Long userId, List<String> conversationIds) {
        return unreadService.batchGet(userId, conversationIds);
    }

    public void clearUnread(Long userId, String conversationId) {
        unreadService.clear(userId, conversationId);
    }

    private void validate(SendMessageRequest request) {
        if (!CLIENT_SENDABLE.contains(request.type())) {
            throw new BizException(ErrorCode.BAD_REQUEST, "不允许的消息类型: " + request.type());
        }
        if (request.isGroupMessage() == (request.receiverId() == null)) {
            throw new BizException(ErrorCode.BAD_REQUEST, "receiverId 与 groupId 必须二选一");
        }
    }

    private static SendResult toResult(MessageDoc doc) {
        return new SendResult(doc.getId(), doc.getConversationId(), doc.getClientMsgId(), doc.getCreatedAt());
    }
}
