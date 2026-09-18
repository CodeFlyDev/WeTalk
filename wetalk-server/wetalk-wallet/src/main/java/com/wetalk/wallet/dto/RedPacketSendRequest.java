package com.wetalk.wallet.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** 发红包请求：totalAmount 单位「分」，前端由元换算 */
public record RedPacketSendRequest(
        @NotBlank(message = "会话不能为空") String conversationId,
        @NotNull(message = "总金额不能为空") @Min(value = 1, message = "总金额至少 1 分") @Max(10_000_00)
        long totalAmount,
        @NotNull(message = "个数不能为空") @Min(1) @Max(100) int count,
        @NotNull(message = "红包类型不能为空") String type,
        @Size(max = 50, message = "祝福语最长 50 字") String greeting) {
}
