package com.wetalk.wallet.listener;

import com.wetalk.wallet.dto.RedPacketIssueCmd;
import com.wetalk.wallet.service.RedPacketService;
import org.apache.rocketmq.spring.annotation.RocketMQMessageListener;
import org.apache.rocketmq.spring.core.RocketMQListener;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * 红包发放消费者：事务消息提交后把 RED_PACKET 消息写入会话（内部发送，含参与者校验与幂等）。
 * 失败抛出异常交由 broker 重试；重试期间 deliver 以 txLog=SENT 幂等。
 */
@Component
@RocketMQMessageListener(topic = RedPacketService.TOPIC, consumerGroup = "wetalk-redpacket-issue-cg")
public class RedPacketIssueConsumer implements RocketMQListener<RedPacketIssueCmd> {

    private static final Logger log = LoggerFactory.getLogger(RedPacketIssueConsumer.class);

    private final RedPacketService redPacketService;

    public RedPacketIssueConsumer(RedPacketService redPacketService) {
        this.redPacketService = redPacketService;
    }

    @Override
    public void onMessage(RedPacketIssueCmd cmd) {
        try {
            redPacketService.deliver(cmd);
        } catch (Exception e) {
            log.error("红包消息入会话失败，等待重试: {}", cmd.redPacketId(), e);
            throw e;
        }
    }
}
