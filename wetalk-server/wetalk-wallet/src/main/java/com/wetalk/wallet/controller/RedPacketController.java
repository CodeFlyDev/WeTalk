package com.wetalk.wallet.controller;

import com.wetalk.auth.security.CurrentUser;
import com.wetalk.common.ApiResult;
import com.wetalk.wallet.dto.RedPacketSendRequest;
import com.wetalk.wallet.dto.RedPacketView;
import com.wetalk.wallet.service.RedPacketService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 红包：发（RocketMQ 事务消息，返回红包 ID；消息经 MQ 异步入会话）/ 抢 / 详情 */
@RestController
@RequestMapping("/api/red-packets")
public class RedPacketController {

    private final RedPacketService redPacketService;

    public RedPacketController(RedPacketService redPacketService) {
        this.redPacketService = redPacketService;
    }

    @PostMapping
    public ApiResult<String> send(@Valid @RequestBody RedPacketSendRequest request) {
        return ApiResult.ok(redPacketService.prepare(CurrentUser.id(), request));
    }

    @PostMapping("/{id}/grab")
    public ApiResult<RedPacketView> grab(@PathVariable String id) {
        return ApiResult.ok(redPacketService.grab(CurrentUser.id(), id));
    }

    @GetMapping("/{id}")
    public ApiResult<RedPacketView> detail(@PathVariable String id) {
        return ApiResult.ok(redPacketService.detail(CurrentUser.id(), id));
    }
}
