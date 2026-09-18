package com.wetalk.wallet.repository;

import com.wetalk.wallet.entity.RedPacketItem;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

import java.util.List;
import java.util.Optional;

public interface RedPacketItemRepository extends JpaRepository<RedPacketItem, Long> {

    /** 抢红包：悲观锁锁定最小未领份，串行化并发领取 */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<RedPacketItem> findFirstByRedPacketIdAndReceiverIdIsNullOrderByIdxAsc(String redPacketId);

    List<RedPacketItem> findByRedPacketIdOrderByIdxAsc(String redPacketId);

    List<RedPacketItem> findByRedPacketIdAndReceiverIdIsNotNullOrderByIdxAsc(String redPacketId);

    long countByRedPacketIdAndReceiverIdIsNull(String redPacketId);

    long countByRedPacketIdAndReceiverIdIsNotNull(String redPacketId);

    boolean existsByRedPacketIdAndReceiverId(String redPacketId, Long receiverId);
}
