package com.wetalk.message.controller;

import com.wetalk.common.security.CurrentUser;
import com.wetalk.common.ApiResult;
import com.wetalk.message.dto.ScheduleCreateRequest;
import com.wetalk.message.service.ScheduledMessageService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 定时消息 REST（t_scheduled_message 由 JPA ddl-auto 自动建表）
 */
@RestController
@RequestMapping("/api/messages/schedule")
public class ScheduledMessageController {

    private final ScheduledMessageService service;

    public ScheduledMessageController(ScheduledMessageService service) {
        this.service = service;
    }

    @PostMapping
    public ApiResult<ScheduledMessageService.ScheduledView> create(@Valid @RequestBody ScheduleCreateRequest request) {
        return ApiResult.ok(ScheduledMessageService.toView(service.create(CurrentUser.id(), request)));
    }

    @GetMapping
    public ApiResult<List<ScheduledMessageService.ScheduledView>> mine() {
        return ApiResult.ok(service.mine(CurrentUser.id()).stream()
                .map(ScheduledMessageService::toView).toList());
    }

    @DeleteMapping("/{id}")
    public ApiResult<Void> cancel(@PathVariable Long id) {
        service.cancel(CurrentUser.id(), id);
        return ApiResult.ok(null);
    }
}
