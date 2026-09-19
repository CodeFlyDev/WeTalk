package com.wetalk.message.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

/**
 * 消息转发请求：目标列表（dm: 对方 userId / group: 群 ID）
 */
public record ForwardRequest(@Valid @NotEmpty List<ForwardTarget> targets) {

    public record ForwardTarget(
            @NotBlank String type,
            @NotNull Long targetId) {
    }
}
