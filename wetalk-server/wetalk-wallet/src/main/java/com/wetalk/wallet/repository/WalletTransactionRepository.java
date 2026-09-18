package com.wetalk.wallet.repository;

import com.wetalk.wallet.entity.WalletTransaction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface WalletTransactionRepository extends JpaRepository<WalletTransaction, Long> {

    List<WalletTransaction> findTop20ByUserIdOrderByCreatedAtDesc(Long userId);
}
