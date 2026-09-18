package com.wetalk.wallet.listener;

import com.wetalk.wallet.dto.RedPacketIssueCmd;
import com.wetalk.wallet.entity.RedPacketTxLog;
import com.wetalk.wallet.repository.RedPacketTxLogRepository;
import com.wetalk.wallet.service.RedPacketService;
import org.apache.rocketmq.spring.annotation.RocketMQTransactionListener;
import org.apache.rocketmq.spring.core.RocketMQLocalTransactionListener;
import org.apache.rocketmq.spring.core.RocketMQLocalTransactionState;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.Message;
import org.springframework.stereotype.Component;

/**
 * 发红包事务消息监听器：
 * executeLocalTransaction —— 执行本地事务（扣款+建红包，同库同事务），成功 COMMIT / 异常 ROLLBACK；
 * checkLocalTransaction —— broker 回查：事务日志存在说明本地事务已提交 → COMMIT，否则 ROLLBACK。
 */
@Component
@RocketMQTransactionListener
public class RedPacketTransactionListener implements RocketMQLocalTransactionListener {

    private static final Logger log = LoggerFactory.getLogger(RedPacketTransactionListener.class);

    private final RedPacketService redPacketService;
    private final RedPacketTxLogRepository txLogRepository;

    public RedPacketTransactionListener(RedPacketService redPacketService,
                                        RedPacketTxLogRepository txLogRepository) {
        this.redPacketService = redPacketService;
        this.txLogRepository = txLogRepository;
    }

    @Override
    public RocketMQLocalTransactionState executeLocalTransaction(Message msg, Object arg) {
        RedPacketIssueCmd cmd = (RedPacketIssueCmd) arg;
        try {
            redPacketService.issue(cmd);
            return RocketMQLocalTransactionState.COMMIT;
        } catch (Exception e) {
            log.warn("红包本地事务失败，事务消息回滚: {}", cmd.redPacketId(), e);
            return RocketMQLocalTransactionState.ROLLBACK;
        }
    }

    @Override
    public RocketMQLocalTransactionState checkLocalTransaction(Message msg) {
        String txKey = (String) msg.getHeaders().get(RedPacketService.HEADER_TX_KEY);
        boolean committed = txKey != null && txLogRepository.existsById(txKey);
        return committed
                ? RocketMQLocalTransactionState.COMMIT
                : RocketMQLocalTransactionState.ROLLBACK;
    }
}
