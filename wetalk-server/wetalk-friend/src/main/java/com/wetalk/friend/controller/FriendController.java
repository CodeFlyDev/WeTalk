package com.wetalk.friend.controller;

import com.wetalk.auth.security.CurrentUser;
import com.wetalk.common.ApiResult;
import com.wetalk.friend.dto.FriendApplyRequest;
import com.wetalk.friend.dto.FriendRequestView;
import com.wetalk.friend.service.FriendService;
import com.wetalk.user.dto.UserView;
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
 * 好友接口：申请 / 同意 / 列表 / 待处理申请 / 删除
 */
@RestController
@RequestMapping("/api/friends")
public class FriendController {

    private final FriendService friendService;

    public FriendController(FriendService friendService) {
        this.friendService = friendService;
    }

    @PostMapping("/requests")
    public ApiResult<FriendRequestView> apply(@Valid @RequestBody FriendApplyRequest request) {
        return ApiResult.ok(friendService.apply(CurrentUser.id(), request.toUserId(), request.remark()));
    }

    @PostMapping("/requests/{id}/accept")
    public ApiResult<Void> accept(@PathVariable Long id) {
        friendService.accept(CurrentUser.id(), id);
        return ApiResult.ok(null);
    }

    @GetMapping("/requests")
    public ApiResult<List<FriendRequestView>> pendingRequests() {
        return ApiResult.ok(friendService.pendingRequests(CurrentUser.id()));
    }

    @GetMapping
    public ApiResult<List<UserView>> friends() {
        return ApiResult.ok(friendService.friends(CurrentUser.id()));
    }

    @DeleteMapping("/{friendId}")
    public ApiResult<Void> remove(@PathVariable Long friendId) {
        friendService.remove(CurrentUser.id(), friendId);
        return ApiResult.ok(null);
    }
}
