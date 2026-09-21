package com.wetalk.wallet.controller;

import com.wetalk.common.security.CurrentUser;
import com.wetalk.common.ApiResult;
import com.wetalk.wallet.dto.WalletView;
import com.wetalk.wallet.service.WalletService;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 钱包：余额 + 流水 + 测试充值 */
@RestController
@RequestMapping("/api/wallet")
public class WalletController {

    private final WalletService walletService;

    public WalletController(WalletService walletService) {
        this.walletService = walletService;
    }

    @GetMapping
    public ApiResult<WalletView> my() {
        return ApiResult.ok(walletService.view(CurrentUser.id()));
    }

    /** 测试充值（单位分；无支付渠道的开发入口，Phase 8 真实支付接入后下线） */
    public record RechargeRequest(@Min(1) @Max(10_000_00) long amount) {
    }

    @PostMapping("/recharge")
    public ApiResult<Void> recharge(@RequestBody RechargeRequest request) {
        walletService.recharge(CurrentUser.id(), request.amount());
        return ApiResult.ok(null);
    }
}
