package com.wetalk.wallet.dto;

import java.time.LocalDateTime;
import java.util.List;

/** 钱包视图：余额 + 最近流水（amount 单位分） */
public record WalletView(
        long balance,
        List<TxView> transactions) {

    public record TxView(Long id, String type, long amount, String refId, String remark, LocalDateTime createdAt) {
    }
}
