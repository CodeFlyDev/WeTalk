package com.wetalk.wallet.repository;

import com.wetalk.wallet.entity.WalletAccount;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Optional;

public interface WalletAccountRepository extends JpaRepository<WalletAccount, Long> {

    Optional<WalletAccount> findByUserId(Long userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from WalletAccount a where a.userId = :userId")
    Optional<WalletAccount> findByUserIdForUpdate(@Param("userId") Long userId);

    /** 条件扣款：余额不足或账户不存在返回 0 行 */
    @Modifying
    @Query("update WalletAccount a set a.balance = a.balance - :amount, a.updatedAt = :now " +
            "where a.userId = :userId and a.balance >= :amount")
    int debit(@Param("userId") Long userId, @Param("amount") long amount, @Param("now") LocalDateTime now);

    @Modifying
    @Query("update WalletAccount a set a.balance = a.balance + :amount, a.updatedAt = :now " +
            "where a.userId = :userId")
    int credit(@Param("userId") Long userId, @Param("amount") long amount, @Param("now") LocalDateTime now);
}
