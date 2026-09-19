package com.wetalk.wallet.job;

import com.wetalk.wallet.entity.RedPacket;
import com.wetalk.wallet.repository.RedPacketRepository;
import com.wetalk.wallet.service.RedPacketService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/** 红包过期退回：每 30s 扫描 ACTIVE 且已过 24h 的红包，未领余款退回发送者 */
@Component
public class RedPacketExpireJob {

    private static final Logger log = LoggerFactory.getLogger(RedPacketExpireJob.class);

    private final RedPacketRepository redPacketRepository;
    private final RedPacketService redPacketService;

    public RedPacketExpireJob(RedPacketRepository redPacketRepository, RedPacketService redPacketService) {
        this.redPacketRepository = redPacketRepository;
        this.redPacketService = redPacketService;
    }

    @Scheduled(fixedDelay = 30_000)
    public void refundExpired() {
        var expired = redPacketRepository.findByStatusAndExpireAtBefore(
                RedPacket.STATUS_ACTIVE, LocalDateTime.now());
        for (RedPacket rp : expired) {
            try {
                redPacketService.refundOne(rp.getId());
            } catch (Exception e) {
                log.error("红包退回失败，下轮重试: {}", rp.getId(), e);
            }
        }
    }
}
