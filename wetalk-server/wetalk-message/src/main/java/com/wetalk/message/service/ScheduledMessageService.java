package com.wetalk.message.service;

import com.wetalk.common.BizException;
import com.wetalk.common.ErrorCode;
import com.wetalk.common.MessageType;
import com.wetalk.message.dto.ScheduleCreateRequest;
import com.wetalk.message.dto.SendMessageRequest;
import com.wetalk.message.dto.SendResult;
import com.wetalk.message.entity.ScheduledMessage;
import com.wetalk.message.port.FriendPort;
import com.wetalk.message.port.GroupPort;
import com.wetalk.message.repository.ScheduledMessageRepository;
import com.wetalk.user.service.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * 定时消息：创建（校验好友/群成员 + 发送时间未来）→ 到期扫描 sendInternal 发出 → 正常推送/未读/ES 链路。
 * 调度由 wallet 模块 @EnableScheduling 全局开启；失败置 FAILED 不重试（避免死循环）。
 */
@Service
public class ScheduledMessageService {

    private static final Logger log = LoggerFactory.getLogger(ScheduledMessageService.class);

    private final ScheduledMessageRepository repository;
    private final MessageService messageService;
    private final UserService userService;
    private final FriendPort friendPort;
    private final GroupPort groupPort;

    public ScheduledMessageService(ScheduledMessageRepository repository,
                                   MessageService messageService,
                                   UserService userService,
                                   FriendPort friendPort,
                                   GroupPort groupPort) {
        this.repository = repository;
        this.messageService = messageService;
        this.userService = userService;
        this.friendPort = friendPort;
        this.groupPort = groupPort;
    }

    @Transactional
    public ScheduledMessage create(Long userId, ScheduleCreateRequest request) {
        if (request.sendAt() == null || request.sendAt().isBefore(LocalDateTime.now().plusSeconds(30))) {
            throw new BizException(ErrorCode.BAD_REQUEST, "发送时间需在 30 秒之后");
        }
        boolean isGroup = request.groupId() != null;
        if (isGroup == (request.receiverId() == null)) {
            throw new BizException(ErrorCode.BAD_REQUEST, "receiverId 与 groupId 必须二选一");
        }
        if (isGroup) {
            if (!groupPort.isMember(request.groupId(), userId)) {
                throw new BizException(ErrorCode.NOT_GROUP_MEMBER, "不是群成员，无法定时发送");
            }
        } else {
            if (!userService.existsById(request.receiverId())) {
                throw new BizException(ErrorCode.USER_NOT_FOUND, "接收用户不存在");
            }
            if (!friendPort.areFriends(userId, request.receiverId())) {
                throw new BizException(ErrorCode.NOT_FRIENDS, "仅好友之间可定时发送单聊消息");
            }
        }
        ScheduledMessage sm = new ScheduledMessage();
        sm.setSenderId(userId);
        sm.setReceiverId(isGroup ? null : request.receiverId());
        sm.setGroupId(isGroup ? request.groupId() : null);
        sm.setType(MessageType.TEXT);
        sm.setContent(request.content().trim());
        sm.setSendAt(request.sendAt());
        return repository.save(sm);
    }

    /** 我的待发送定时消息（时间升序） */
    @Transactional(readOnly = true)
    public List<ScheduledMessage> mine(Long userId) {
        return repository.findBySenderIdAndStatusOrderBySendAtAsc(userId, ScheduledMessage.STATUS_PENDING);
    }

    /** 取消（仅本人、未发送） */
    @Transactional
    public void cancel(Long userId, Long id) {
        ScheduledMessage sm = repository.findById(id)
                .orElseThrow(() -> new BizException(ErrorCode.NOT_FOUND, "定时消息不存在"));
        if (!sm.getSenderId().equals(userId)) {
            throw new BizException(ErrorCode.FORBIDDEN, "无权取消他人定时消息");
        }
        if (!ScheduledMessage.STATUS_PENDING.equals(sm.getStatus())) {
            throw new BizException(ErrorCode.BIZ_ERROR, "该消息已处理，无法取消");
        }
        sm.setStatus(ScheduledMessage.STATUS_CANCELLED);
        repository.save(sm);
    }

    /** 每 30s 扫描到期消息发出（应用层双写链路：推送/未读/ES 索引全部复用） */
    @Scheduled(fixedDelay = 30_000)
    public void dispatch() {
        List<ScheduledMessage> due = repository.findByStatusAndSendAtLessThanEqual(
                ScheduledMessage.STATUS_PENDING, LocalDateTime.now());
        for (ScheduledMessage sm : due) {
            try {
                messageService.sendInternal(sm.getSenderId(), new SendMessageRequest(
                        sm.getReceiverId(), sm.getGroupId(), sm.getType(), sm.getContent(),
                        null, "sched-" + UUID.randomUUID(), null, null, null));
                sm.setStatus(ScheduledMessage.STATUS_SENT);
                sm.setSentAt(LocalDateTime.now());
            } catch (Exception e) {
                log.warn("scheduled message send failed, id={}", sm.getId(), e);
                sm.setStatus(ScheduledMessage.STATUS_FAILED);
                sm.setFailReason(e.getMessage() == null ? "发送失败" : e.getMessage().substring(0, Math.min(250, e.getMessage().length())));
            }
            repository.save(sm);
        }
    }

    public record ScheduledView(Long id, Long senderId, Long receiverId, Long groupId,
                                String content, LocalDateTime sendAt, String status, String failReason) {
    }

    public static ScheduledView toView(ScheduledMessage sm) {
        return new ScheduledView(sm.getId(), sm.getSenderId(), sm.getReceiverId(), sm.getGroupId(),
                sm.getContent(), sm.getSendAt(), sm.getStatus(), sm.getFailReason());
    }
}
