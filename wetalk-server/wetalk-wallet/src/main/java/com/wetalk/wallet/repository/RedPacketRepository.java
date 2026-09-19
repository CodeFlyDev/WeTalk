package com.wetalk.wallet.repository;

import com.wetalk.wallet.entity.RedPacket;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface RedPacketRepository extends JpaRepository<RedPacket, String> {

    List<RedPacket> findByStatusAndExpireAtBefore(String status, LocalDateTime time);
}
