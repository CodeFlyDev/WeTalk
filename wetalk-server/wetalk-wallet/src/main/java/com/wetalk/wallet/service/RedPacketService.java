package com.wetalk.wallet.service;

import com.wetalk.common.BizException;
import com.wetalk.common.ErrorCode;
import com.wetalk.common.MessageType;
import com.wetalk.message.dto.SendMessageRequest;
import com.wetalk.message.port.FriendPort;
import com.wetalk.message.port.GroupPort;
import com.wetalk.message.service.MessageService;
import com.wetalk.user.dto.UserView;
import com.wetalk.user.service.UserService;
import com.wetalk.wallet.dto.RedPacketIssueCmd;
import com.wetalk.wallet.dto.RedPacketSendRequest;
import com.wetalk.wallet.dto.RedPacketView;
import com.wetalk.wallet.entity.RedPacket;
import com.wetalk.wallet.entity.RedPacketItem;
import com.wetalk.wallet.entity.RedPacketTxLog;
import com.wetalk.wallet.entity.WalletTransaction;
import com.wetalk.wallet.repository.RedPacketItemRepository;
import com.wetalk.wallet.repository.RedPacketRepository;
import com.wetalk.wallet.repository.RedPacketTxLogRepository;
import com.wetalk.wallet.repository.WalletAccountRepository;
import com.wetalk.wallet.repository.WalletTransactionRepository;
import org.apache.rocketmq.spring.core.RocketMQTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.Message;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

/**
 * 红包领域服务。
 * 发红包（RocketMQ 事务消息，跨「扣款事务」与「消息入会话」最终一致）：
 *   1. prepare：同步预校验（参与者/好友/余额）→ 发半消息
 *   2. issue（本地事务）：条件扣款 + 建红包/子份 + 写事务日志（同库同事务）
 *   3. 提交后消费者 deliver：RED_PACKET 消息入会话（clientMsgId 幂等）→ 回写 SENT
 *   4. 回查：事务日志存在 → COMMIT，否则 ROLLBACK
 * 抢红包走 MySQL 悲观锁串行化；24h 未抢完由定时任务退回余款。
 */
@Service
public class RedPacketService {

    private static final Logger log = LoggerFactory.getLogger(RedPacketService.class);

    public static final String TOPIC = "wetalk-redpacket-tx";
    public static final String HEADER_TX_KEY = "txKey";

    private static final long MAX_TOTAL = 10_000_00;
    private static final int MAX_COUNT = 100;

    private final RedPacketRepository redPacketRepository;
    private final RedPacketItemRepository itemRepository;
    private final RedPacketTxLogRepository txLogRepository;
    private final WalletAccountRepository accountRepository;
    private final WalletTransactionRepository txRepository;
    private final WalletService walletService;
    private final MessageService messageService;
    private final FriendPort friendPort;
    private final GroupPort groupPort;
    private final UserService userService;
    private final RocketMQTemplate rocketMQTemplate;
    private final org.springframework.context.ApplicationEventPublisher eventPublisher;

    public RedPacketService(RedPacketRepository redPacketRepository,
                            RedPacketItemRepository itemRepository,
                            RedPacketTxLogRepository txLogRepository,
                            WalletAccountRepository accountRepository,
                            WalletTransactionRepository txRepository,
                            WalletService walletService,
                            MessageService messageService,
                            FriendPort friendPort,
                            GroupPort groupPort,
                            UserService userService,
                            RocketMQTemplate rocketMQTemplate,
                            org.springframework.context.ApplicationEventPublisher eventPublisher) {
        this.redPacketRepository = redPacketRepository;
        this.itemRepository = itemRepository;
        this.txLogRepository = txLogRepository;
        this.accountRepository = accountRepository;
        this.txRepository = txRepository;
        this.walletService = walletService;
        this.messageService = messageService;
        this.friendPort = friendPort;
        this.groupPort = groupPort;
        this.userService = userService;
        this.rocketMQTemplate = rocketMQTemplate;
        this.eventPublisher = eventPublisher;
    }

    // ---------------- 发红包 ----------------

    /** 发红包入口：同步预校验给用户即时反馈，资金变动交给事务消息的本地事务 */
    public String prepare(Long senderId, RedPacketSendRequest request) {
        ConvRef conv = parse(request.conversationId(), senderId);
        assertCanSend(senderId, conv);
        if (!RedPacket.TYPE_ORDINARY.equals(request.type()) && !RedPacket.TYPE_LUCKY.equals(request.type())) {
            throw new BizException(ErrorCode.BAD_REQUEST, "红包类型不合法");
        }
        if (request.totalAmount() > MAX_TOTAL || request.count() > MAX_COUNT
                || request.totalAmount() < request.count()) {
            throw new BizException(ErrorCode.BAD_REQUEST, "金额/个数不合法（每份至少 1 分，单笔上限 1 万元）");
        }
        // 余额预校验（即时反馈；并发超扣由本地事务条件扣款兜底回滚）
        WalletAccount account = accountRepository.findByUserId(senderId).orElse(null);
        if (account == null || account.getBalance() < request.totalAmount()) {
            throw new BizException(ErrorCode.WALLET_INSUFFICIENT, "余额不足，请先充值");
        }

        String redPacketId = UUID.randomUUID().toString().replace("-", "");
        RedPacketIssueCmd cmd = new RedPacketIssueCmd(
                redPacketId, senderId, conv.receiverId(), conv.groupId(), request.conversationId(),
                request.totalAmount(), request.count(), request.type(),
                request.greeting() == null || request.greeting().isBlank() ? "恭喜发财，大吉大利" : request.greeting(),
                "rp-" + redPacketId);

        Message<RedPacketIssueCmd> message = MessageBuilder.withPayload(cmd)
                .setHeader(HEADER_TX_KEY, redPacketId)
                .build();
        rocketMQTemplate.sendMessageInTransaction(TOPIC, message, cmd);
        eventPublisher.publishEvent(new com.wetalk.common.AchieveEvent(senderId, "FIRST_RED_PACKET"));
        return redPacketId;
    }

    /** 本地事务：条件扣款 + 建红包/子份 + 事务日志（由事务消息监听器调用，异常 → 消息回滚） */
    @Transactional
    public void issue(RedPacketIssueCmd cmd) {
        int rows = accountRepository.debit(cmd.senderId(), cmd.totalAmount(), LocalDateTime.now());
        if (rows == 0) {
            throw new BizException(ErrorCode.WALLET_INSUFFICIENT, "余额不足");
        }
        txRepository.save(WalletTransaction.of(cmd.senderId(), WalletTransaction.RED_PACKET_SEND,
                cmd.totalAmount(), cmd.redPacketId(), "发出红包"));

        LocalDateTime now = LocalDateTime.now();
        RedPacket rp = new RedPacket();
        rp.setId(cmd.redPacketId());
        rp.setConversationId(cmd.conversationId());
        rp.setSenderId(cmd.senderId());
        rp.setTotalAmount(cmd.totalAmount());
        rp.setCount(cmd.count());
        rp.setType(cmd.type());
        rp.setGreeting(cmd.greeting());
        rp.setStatus(RedPacket.STATUS_ACTIVE);
        rp.setExpireAt(now.plus(RedPacket.EXPIRE));
        rp.setCreatedAt(now);
        redPacketRepository.save(rp);

        long[] amounts = splitAmounts(cmd.totalAmount(), cmd.count(), cmd.type());
        for (int i = 0; i < amounts.length; i++) {
            RedPacketItem item = new RedPacketItem();
            item.setRedPacketId(cmd.redPacketId());
            item.setIdx(i);
            item.setAmount(amounts[i]);
            itemRepository.save(item);
        }

        RedPacketTxLog txLog = new RedPacketTxLog();
        txLog.setTxKey(cmd.redPacketId());
        txLog.setStatus(RedPacketTxLog.PREPARED);
        txLog.setCreatedAt(now);
        txLogRepository.save(txLog);
    }

    /** 消息入会话（消费者调用；clientMsgId 幂等，失败抛异常交由 MQ 重试） */
    public void deliver(RedPacketIssueCmd cmd) {
        RedPacketTxLog txLog = txLogRepository.findById(cmd.redPacketId())
                .orElseThrow(() -> new BizException(ErrorCode.SYSTEM_ERROR, "事务日志缺失: " + cmd.redPacketId()));
        if (RedPacketTxLog.SENT.equals(txLog.getStatus())) {
            return;
        }
        SendMessageRequest request = new SendMessageRequest(cmd.receiverId(), cmd.groupId(),
                MessageType.RED_PACKET, cmd.redPacketId(), null, cmd.clientMsgId(), null, null, null);
        messageService.sendInternal(cmd.senderId(), request);
        txLog.setStatus(RedPacketTxLog.SENT);
        txLogRepository.save(txLog);
    }

    // ---------------- 抢红包 ----------------

    @Transactional
    public RedPacketView grab(Long userId, String redPacketId) {
        RedPacket rp = redPacketRepository.findById(redPacketId)
                .orElseThrow(() -> new BizException(ErrorCode.NOT_FOUND, "红包不存在"));
        ConvRef conv = parse(rp.getConversationId(), rp.getSenderId());
        assertParticipant(userId, rp.getSenderId(), conv);

        // 先锁定最小未领份（悲观锁串行化并发），再判定领取资格
        RedPacketItem item = itemRepository.findFirstByRedPacketIdAndReceiverIdIsNullOrderByIdxAsc(redPacketId)
                .orElse(null);
        if (item == null) {
            throw new BizException(ErrorCode.RED_PACKET_EXHAUSTED,
                    RedPacket.STATUS_EXPIRED.equals(rp.getStatus()) ? "红包已过期" : "红包已被抢完");
        }
        if (itemRepository.existsByRedPacketIdAndReceiverId(redPacketId, userId)) {
            throw new BizException(ErrorCode.RED_PACKET_GRABBED, "已领取过该红包");
        }
        if (!RedPacket.STATUS_ACTIVE.equals(rp.getStatus())) {
            throw new BizException(ErrorCode.BIZ_ERROR, "红包已过期或已失效");
        }

        LocalDateTime now = LocalDateTime.now();
        item.setReceiverId(userId);
        item.setReceivedAt(now);
        itemRepository.save(item);

        walletService.credit(userId, item.getAmount(), WalletTransaction.RED_PACKET_RECV,
                redPacketId, "领取红包");

        if (itemRepository.countByRedPacketIdAndReceiverIdIsNull(redPacketId) == 0) {
            rp.setStatus(RedPacket.STATUS_FINISHED);
        }
        redPacketRepository.save(rp);
        return toView(rp, userId);
    }

    // ---------------- 详情 ----------------

    @Transactional(readOnly = true)
    public RedPacketView detail(Long userId, String redPacketId) {
        RedPacket rp = redPacketRepository.findById(redPacketId)
                .orElseThrow(() -> new BizException(ErrorCode.NOT_FOUND, "红包不存在"));
        assertParticipant(userId, rp.getSenderId(), parse(rp.getConversationId(), rp.getSenderId()));
        return toView(rp, userId);
    }

    // ---------------- 过期退回 ----------------

    /** 退回单个过期红包的未领余款（定时任务逐个调用，独立事务） */
    @Transactional
    public void refundOne(String redPacketId) {
        RedPacket rp = redPacketRepository.findById(redPacketId).orElse(null);
        if (rp == null || !RedPacket.STATUS_ACTIVE.equals(rp.getStatus())) {
            return;
        }
        long unclaimed = itemRepository.findByRedPacketIdOrderByIdxAsc(redPacketId).stream()
                .filter(i -> i.getReceiverId() == null)
                .mapToLong(RedPacketItem::getAmount)
                .sum();
        if (unclaimed > 0) {
            walletService.credit(rp.getSenderId(), unclaimed, WalletTransaction.RED_PACKET_REFUND,
                    redPacketId, "红包过期退回");
        }
        rp.setStatus(RedPacket.STATUS_EXPIRED);
        redPacketRepository.save(rp);
        log.info("红包过期退回完成: {} -> 退回 {} 分", redPacketId, unclaimed);
    }

    // ---------------- 视图 ----------------

    private RedPacketView toView(RedPacket rp, Long viewerId) {
        UserView sender = userService.toView(userService.requireById(rp.getSenderId()));
        List<RedPacketItem> claimed = itemRepository
                .findByRedPacketIdAndReceiverIdIsNotNullOrderByIdxAsc(rp.getId());
        List<RedPacketView.ItemView> items = new ArrayList<>(claimed.size());
        for (RedPacketItem item : claimed) {
            UserView receiver = userService.toView(userService.requireById(item.getReceiverId()));
            items.add(new RedPacketView.ItemView(item.getIdx(), item.getAmount(), item.getReceiverId(),
                    receiver.nickname().isBlank() ? receiver.username() : receiver.nickname(), item.getReceivedAt()));
        }
        long remain = itemRepository.countByRedPacketIdAndReceiverIdIsNull(rp.getId());
        Long receivedByMe = claimed.stream()
                .filter(i -> viewerId.equals(i.getReceiverId()))
                .findFirst()
                .map(RedPacketItem::getAmount)
                .orElse(null);
        boolean expired = LocalDateTime.now().isAfter(rp.getExpireAt());
        boolean canGrab = RedPacket.STATUS_ACTIVE.equals(rp.getStatus()) && !expired && remain > 0
                && receivedByMe == null && canGrabView(rp, viewerId);
        return new RedPacketView(rp.getId(), rp.getSenderId(),
                sender.nickname().isBlank() ? sender.username() : sender.nickname(),
                rp.getConversationId(), rp.getTotalAmount(), rp.getCount(), rp.getType(),
                rp.getGreeting(), rp.getStatus(), rp.getExpireAt(), receivedByMe, canGrab, (int) remain, items);
    }

    /** 单聊仅对方可领（微信规则），群聊成员均可领（含发送者） */
    private boolean canGrabView(RedPacket rp, Long userId) {
        ConvRef conv = parse(rp.getConversationId(), rp.getSenderId());
        if (conv.groupId() != null) {
            return true;
        }
        return conv.receiverId() != null && conv.receiverId().equals(userId);
    }

    // ---------------- 内部工具 ----------------

    private void assertCanSend(Long senderId, ConvRef conv) {
        if (conv.groupId() != null) {
            if (!groupPort.isMember(conv.groupId(), senderId)) {
                throw new BizException(ErrorCode.NOT_GROUP_MEMBER, "不是群成员，无法发红包");
            }
        } else if (!friendPort.areFriends(senderId, conv.receiverId())) {
            throw new BizException(ErrorCode.NOT_FRIENDS, "仅好友之间可发红包");
        }
    }

    private void assertParticipant(Long userId, Long senderId, ConvRef conv) {
        if (conv.groupId() != null) {
            if (!groupPort.isMember(conv.groupId(), userId)) {
                throw new BizException(ErrorCode.FORBIDDEN, "无权查看该红包");
            }
        } else if (!userId.equals(senderId) && !userId.equals(conv.receiverId())) {
            throw new BizException(ErrorCode.FORBIDDEN, "无权查看该红包");
        }
    }

    /** 解析会话引用：dm → receiverId = 发送者的对方；g → groupId */
    private ConvRef parse(String conversationId, Long selfId) {
        try {
            if (conversationId.startsWith("g:")) {
                return new ConvRef(null, Long.parseLong(conversationId.substring(2)));
            }
            if (conversationId.startsWith("dm:")) {
                String[] parts = conversationId.substring(3).split(":");
                long a = Long.parseLong(parts[0]);
                long b = Long.parseLong(parts[1]);
                long receiver = selfId != null && selfId == a ? b : a;
                return new ConvRef(receiver, null);
            }
            throw new NumberFormatException(conversationId);
        } catch (NumberFormatException e) {
            throw new BizException(ErrorCode.BAD_REQUEST, "非法会话: " + conversationId);
        }
    }

    /**
     * 金额拆分（分）：ORDINARY 均分（余数摊前几份）；LUCKY 二倍均值随机，保底每份至少 1 分。
     */
    static long[] splitAmounts(long total, int count, String type) {
        long[] amounts = new long[count];
        if (count == 1) {
            amounts[0] = total;
            return amounts;
        }
        if (RedPacket.TYPE_ORDINARY.equals(type)) {
            long base = total / count;
            long remainder = total % count;
            for (int i = 0; i < count; i++) {
                amounts[i] = base + (i < remainder ? 1 : 0);
            }
            return amounts;
        }
        ThreadLocalRandom rnd = ThreadLocalRandom.current();
        long remain = total;
        int n = count;
        for (int i = 0; i < count - 1; i++) {
            long bound = Math.min(remain / n * 2, remain - (n - 1)); // 二倍均值，且保底余下每人 1 分
            long amount = rnd.nextLong(1, bound + 1);
            amounts[i] = amount;
            remain -= amount;
            n--;
        }
        amounts[count - 1] = remain;
        return amounts;
    }

    /** 会话引用：dm → receiverId（发送者的对方）；群 → groupId */
    private record ConvRef(Long receiverId, Long groupId) {
    }
}
