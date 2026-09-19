package com.wetalk.wallet.repository;

import com.wetalk.wallet.entity.RedPacketTxLog;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RedPacketTxLogRepository extends JpaRepository<RedPacketTxLog, String> {
}
