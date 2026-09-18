package com.wetalk.wallet.service;

import com.wetalk.common.BizException;
import com.wetalk.common.ErrorCode;
import com.wetalk.wallet.dto.WalletView;
import com.wetalk.wallet.entity.WalletAccount;
import com.wetalk.wallet.entity.WalletTransaction;
import com.wetalk.wallet.repository.WalletAccountRepository;
import com.wetalk.wallet.repository.WalletTransactionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/** 钱包领域服务：开户 / 余额查询 / 入账（出账由 RedPacketService 条件 UPDATE 原子扣款） */
@Service
public class WalletService {

    /** 单笔充值上限 1 万元（分），测试充值接口用 */
    private static final long MAX_AMOUNT = 10_000_00;

    private final WalletAccountRepository accountRepository;
    private final WalletTransactionRepository txRepository;

    public WalletService(WalletAccountRepository accountRepository, WalletTransactionRepository txRepository) {
        this.accountRepository = accountRepository;
        this.txRepository = txRepository;
    }

    @Transactional
    public WalletAccount ensureAccount(Long userId) {
        return accountRepository.findByUserId(userId).orElseGet(() -> {
            WalletAccount account = new WalletAccount();
            account.setUserId(userId);
            account.setBalance(0);
            LocalDateTime now = LocalDateTime.now();
            account.setCreatedAt(now);
            account.setUpdatedAt(now);
            return accountRepository.save(account);
        });
    }

    @Transactional(readOnly = true)
    public WalletView view(Long userId) {
        long balance = accountRepository.findByUserId(userId)
                .map(WalletAccount::getBalance)
                .orElse(0L);
        var transactions = txRepository.findTop20ByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(t -> new WalletView.TxView(t.getId(), t.getType(), t.getAmount(),
                        t.getRefId(), t.getRemark(), t.getCreatedAt()))
                .toList();
        return new WalletView(balance, transactions);
    }

    /** 测试充值（无支付渠道，Phase 8 接入后替换为真实支付回调） */
    @Transactional
    public void recharge(Long userId, long amount) {
        if (amount <= 0 || amount > MAX_AMOUNT) {
            throw new BizException(ErrorCode.BAD_REQUEST, "充值金额不合法");
        }
        credit(userId, amount, WalletTransaction.RECHARGE, null, "测试充值");
    }

    /** 入账：账户不存在时自动开户，并记录流水 */
    @Transactional
    public void credit(Long userId, long amount, String type, String refId, String remark) {
        ensureAccount(userId);
        int rows = accountRepository.credit(userId, amount, LocalDateTime.now());
        if (rows == 0) {
            throw new BizException(ErrorCode.SYSTEM_ERROR, "入账失败，请稍后重试");
        }
        txRepository.save(WalletTransaction.of(userId, type, amount, refId, remark));
    }
}
