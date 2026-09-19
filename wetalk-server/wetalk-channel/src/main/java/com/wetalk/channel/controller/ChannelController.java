package com.wetalk.channel.controller;

import com.wetalk.auth.security.CurrentUser;
import com.wetalk.channel.service.ChannelService;
import com.wetalk.common.ApiResult;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 频道/社区 REST（实时消息广播走 STOMP /topic/channel.{id}）
 */
@RestController
@RequestMapping("/api/channels")
public class ChannelController {

    public record CreateRequest(@NotBlank(message = "频道名不能为空") @Size(max = 20) String name,
                                @Size(max = 200) String description) {
    }

    public record SendRequest(@NotBlank(message = "消息不能为空") @Size(max = 2000) String content) {
    }

    private final ChannelService channelService;

    public ChannelController(ChannelService channelService) {
        this.channelService = channelService;
    }

    /** 创建频道（创建者自动加入） */
    @PostMapping
    public ApiResult<Map<String, Object>> create(@Valid @RequestBody CreateRequest request) {
        return ApiResult.ok(channelService.create(CurrentUser.id(), request.name(), request.description()));
    }

    /** 频道列表（我加入的在前 + 成员数 + joined 标记） */
    @GetMapping
    public ApiResult<List<Map<String, Object>>> list() {
        return ApiResult.ok(channelService.list(CurrentUser.id()));
    }

    /** 加入频道 */
    @PostMapping("/{id}/join")
    public ApiResult<Void> join(@PathVariable Long id) {
        channelService.join(CurrentUser.id(), id);
        return ApiResult.ok(null);
    }

    /** 退出频道（频道主不可退） */
    @DeleteMapping("/{id}/join")
    public ApiResult<Void> quit(@PathVariable Long id) {
        channelService.quit(CurrentUser.id(), id);
        return ApiResult.ok(null);
    }

    /** 解散频道（仅频道主） */
    @DeleteMapping("/{id}")
    public ApiResult<Void> dissolve(@PathVariable Long id) {
        channelService.dissolve(CurrentUser.id(), id);
        return ApiResult.ok(null);
    }

    /** 发送消息（仅成员；同步返回 view 供发送端上屏，广播给订阅者） */
    @PostMapping("/{id}/messages")
    public ApiResult<Map<String, Object>> send(@PathVariable Long id, @Valid @RequestBody SendRequest request) {
        return ApiResult.ok(channelService.send(CurrentUser.id(), id, request.content()));
    }

    /** 历史消息（最近 50 条，正序） */
    @GetMapping("/{id}/messages")
    public ApiResult<List<Map<String, Object>>> history(@PathVariable Long id) {
        return ApiResult.ok(channelService.history(CurrentUser.id(), id));
    }
}
