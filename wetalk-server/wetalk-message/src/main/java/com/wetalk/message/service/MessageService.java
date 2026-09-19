package com.wetalk.message.service;

import com.wetalk.common.BizException;
import com.wetalk.common.ErrorCode;
import com.wetalk.common.MessageType;
import com.wetalk.message.document.MessageDoc;
import com.wetalk.message.dto.ForwardRequest;
import com.wetalk.message.dto.GroupFileView;
import com.wetalk.message.dto.MessageView;
import com.wetalk.message.dto.SendMessageRequest;
import com.wetalk.message.dto.SendResult;
import com.wetalk.message.port.FriendPort;
import com.wetalk.message.port.GroupPort;
import com.wetalk.message.presence.UnreadService;
import com.wetalk.message.repository.MessageRepository;
import com.wetalk.message.search.MessageIndexer;
import com.wetalk.message.util.ConversationIds;
import com.wetalk.user.service.UserService;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

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
    private final MessageIndexer searchIndexer;

    public MessageService(MessageRepository messageRepository,
                          UserService userService,
                          FriendPort friendPort,
                          GroupPort groupPort,
                          MessageDeliveryService deliveryService,
                          UnreadService unreadService,
                          MessageIndexer searchIndexer) {
        this.messageRepository = messageRepository;
        this.userService = userService;
        this.friendPort = friendPort;
        this.groupPort = groupPort;
        this.deliveryService = deliveryService;
        this.unreadService = unreadService;
        this.searchIndexer = searchIndexer;
    }

    public SendResult send(Long senderId, SendMessageRequest request) {
        validate(request);
        return doSend(senderId, request);
    }

    /** 模块内部发送：跳过客户端类型白名单（RED_PACKET 等业务消息由服务端产生），其余校验与推送链路一致 */
    public SendResult sendInternal(Long senderId, SendMessageRequest request) {
        if (request.isGroupMessage() == (request.receiverId() == null)) {
            throw new BizException(ErrorCode.BAD_REQUEST, "receiverId 与 groupId 必须二选一");
        }
        return doSend(senderId, request);
    }

    private SendResult doSend(Long senderId, SendMessageRequest request) {
        MessageDoc doc = new MessageDoc();
        doc.setSenderId(senderId);
        doc.setType(request.type());
        doc.setContent(request.content());
        doc.setRefObjectKey(request.refObjectKey());
        doc.setClientMsgId(request.clientMsgId());
        doc.setReplyToId(request.replyToId());
        doc.setMentionedUserIds(request.mentionedUserIds() == null ? List.of() : request.mentionedUserIds());
        doc.setBurnAfterReading(Boolean.TRUE.equals(request.burnAfterRead()));
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
        searchIndexer.index(doc);
        return toResult(doc);
    }

    /**
     * 撤回：仅发送者本人、2 分钟内、未撤回过。
     * 成功后向在线接收方推送 RECALL 事件（离线方补拉历史时看到 recalled=true 占位）。
     */
    public MessageView recall(Long userId, String messageId) {
        MessageDoc doc = requireParticipantDoc(userId, messageId);
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
        searchIndexer.delete(messageId);

        List<Long> recipients = recipientsOf(doc, userId);
        deliveryService.deliverRecall(MessageDeliveryService.toView(doc), recipients);
        return MessageDeliveryService.toView(doc);
    }

    /**
     * 阅后即焚：接收方（非发送者）阅读倒计时结束后触发。
     * 内容与附件引用清空并标记 burned，ES 删档，向会话在线方推送 burned MessageView 原地替换。
     */
    public MessageView burn(Long userId, String messageId) {
        MessageDoc doc = requireParticipantDoc(userId, messageId);
        if (doc.getSenderId().equals(userId)) {
            throw new BizException(ErrorCode.FORBIDDEN, "发送者无需焚毁（可用撤回）");
        }
        if (doc.isBurned()) {
            return MessageDeliveryService.toView(doc);
        }
        doc.setBurned(true);
        doc.setContent(null);
        doc.setRefObjectKey(null);
        messageRepository.save(doc);
        searchIndexer.delete(messageId);
        deliveryService.deliverRecall(MessageDeliveryService.toView(doc), recipientsOf(doc, userId));
        return MessageDeliveryService.toView(doc);
    }

    /** 置顶 / 取消置顶：会话参与者均可操作（dm 双方 / 群任意成员）。
     * 成功后向在线接收方推送携带最新 pinned 状态的 MessageView，前端按 id 原地更新。
     */
    public MessageView setPinned(Long userId, String messageId, boolean pinned) {
        MessageDoc doc = requireParticipantDoc(userId, messageId);
        if (doc.isRecalled()) {
            throw new BizException(ErrorCode.BIZ_ERROR, "已撤回的消息不能置顶");
        }
        doc.setPinned(pinned);
        doc.setPinnedBy(pinned ? userId : null);
        doc.setPinnedAt(pinned ? LocalDateTime.now() : null);
        messageRepository.save(doc);
        deliveryService.deliverPin(MessageDeliveryService.toView(doc), recipientsOf(doc, userId));
        return MessageDeliveryService.toView(doc);
    }

    /** 会话置顶消息列表（时间倒序，校验请求者是会话参与者） */
    public List<MessageView> pinned(Long userId, String conversationId) {
        assertParticipant(userId, conversationId);
        return messageRepository.findByConversationIdAndPinnedTrueOrderByPinnedAtDesc(conversationId)
                .stream()
                .map(MessageDeliveryService::toView)
                .toList();
    }

    /**
     * 转发消息到多个目标会话：源消息参与者校验 → 逐个目标走 sendInternal（正常推送/ES 链路）。
     * 产生全新消息（新 clientMsgId），引用与 @ 丢弃；红包不可转发。
     */
    public List<SendResult> forward(Long userId, String messageId, ForwardRequest request) {
        MessageDoc origin = requireParticipantDoc(userId, messageId);
        if (origin.isRecalled()) {
            throw new BizException(ErrorCode.BIZ_ERROR, "已撤回的消息不能转发");
        }
        if (origin.getType() == MessageType.RED_PACKET) {
            throw new BizException(ErrorCode.BIZ_ERROR, "红包不支持转发");
        }
        List<SendResult> results = new java.util.ArrayList<>(request.targets().size());
        for (ForwardRequest.ForwardTarget target : request.targets()) {
            SendMessageRequest send;
            if ("group".equals(target.type())) {
                send = new SendMessageRequest(null, target.targetId(), origin.getType(),
                        origin.getContent(), origin.getRefObjectKey(), "fwd-" + UUID.randomUUID(),
                        null, null, null);
            } else {
                send = new SendMessageRequest(target.targetId(), null, origin.getType(),
                        origin.getContent(), origin.getRefObjectKey(), "fwd-" + UUID.randomUUID(),
                        null, null, null);
            }
            results.add(sendInternal(userId, send));
        }
        return results;
    }

    /** 群文件：聚合群会话内 type=FILE 的消息（校验请求者是群成员） */
    public List<GroupFileView> groupFiles(Long userId, Long groupId) {
        if (!groupPort.isMember(groupId, userId)) {
            throw new BizException(ErrorCode.NOT_GROUP_MEMBER, "不是群成员");
        }
        return messageRepository
                .findTop100ByConversationIdAndTypeOrderByCreatedAtDesc(
                        ConversationIds.group(groupId), MessageType.FILE)
                .stream()
                .map(doc -> new GroupFileView(doc.getId(), doc.getSenderId(),
                        doc.getContent(), doc.getRefObjectKey(), doc.getCreatedAt()))
                .toList();
    }

    /** 按 ID 查询单条消息（引用条回显），校验请求者是会话参与者 */
    public MessageView get(Long userId, String messageId) {
        return MessageDeliveryService.toView(requireParticipantDoc(userId, messageId));
    }

    /** 会话最近消息（AI 摘要等跨模块取材用），校验请求者是会话参与者，返回旧→新 */
    public List<MessageView> recent(Long userId, String conversationId, int limit) {
        assertParticipant(userId, conversationId);
        int size = limit <= 0 ? 20 : Math.min(limit, 50);
        return messageRepository.findTop50ByConversationIdOrderByCreatedAtDesc(conversationId)
                .stream()
                .limit(size)
                .map(MessageDeliveryService::toView)
                .toList()
                .reversed();
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

    /** 会话内全文检索（ES 双写索引，故障降级返回空列表） */
    public List<MessageView> search(Long userId, String conversationId, String keyword, int limit) {
        assertParticipant(userId, conversationId);
        int size = limit <= 0 ? 20 : Math.min(limit, 50);
        return searchIndexer.search(conversationId, keyword, size);
    }

    /** 全局检索「与我相关」的消息（我的单聊 + 我所在的群聊） */
    public List<MessageView> searchGlobal(Long userId, String keyword, int limit) {
        int size = limit <= 0 ? 20 : Math.min(limit, 50);
        return searchIndexer.searchGlobal(userId, groupPort.myGroupIds(userId), keyword, size);
    }

    /** 会话参与者校验：dm 校验双方，g 校验群成员（public：AI 摘要等跨模块取材复用） */
    public void assertParticipant(Long userId, String conversationId) {
        boolean participant;
        if (conversationId.startsWith("g:")) {
            participant = groupPort.isMember(Long.parseLong(conversationId.substring(2)), userId);
        } else if (conversationId.startsWith("dm:")) {
            String[] parts = conversationId.substring(3).split(":");
            long a = Long.parseLong(parts[0]);
            long b = Long.parseLong(parts[1]);
            participant = userId == a || userId == b;
        } else {
            participant = false;
        }
        if (!participant) {
            throw new BizException(ErrorCode.FORBIDDEN, "无权访问该会话");
        }
    }

    /** 按 ID 取消息并校验请求者是会话参与者（dm 双方 / 群成员） */
    private MessageDoc requireParticipantDoc(Long userId, String messageId) {
        MessageDoc doc = messageRepository.findById(messageId)
                .orElseThrow(() -> new BizException(ErrorCode.NOT_FOUND, "消息不存在"));
        boolean participant;
        if (doc.getGroupId() != null) {
            participant = groupPort.isMember(doc.getGroupId(), userId);
        } else {
            participant = doc.getSenderId().equals(userId) || userId.equals(doc.getReceiverId());
        }
        if (!participant) {
            throw new BizException(ErrorCode.FORBIDDEN, "无权操作该消息");
        }
        return doc;
    }

    /** 消息投递对象：群 → 其他成员；单聊 → 对方 */
    private List<Long> recipientsOf(MessageDoc doc, Long operatorId) {
        return doc.getGroupId() != null
                ? groupPort.memberIds(doc.getGroupId()).stream().filter(id -> !id.equals(operatorId)).toList()
                : List.of(doc.getReceiverId());
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
