package com.wetalk.user.controller;

import com.wetalk.common.security.CurrentUser;
import com.wetalk.common.ApiResult;
import com.wetalk.user.dto.UserView;
import com.wetalk.user.service.UserService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 用户资料接口（认证由 SecurityConfig 统一保护）
 */
@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    /** 用户搜索（加好友用）：用户名 / 昵称模糊匹配，最多 10 条 */
    @GetMapping("/search")
    public ApiResult<List<UserView>> search(@RequestParam String keyword) {
        return ApiResult.ok(userService.search(keyword));
    }

    /** 更新我的头像（objectKey 来自 MinIO presign 直传） */
    @org.springframework.web.bind.annotation.PutMapping("/me/avatar")
    public ApiResult<UserView> updateAvatar(@org.springframework.web.bind.annotation.RequestBody
                                            AvatarRequest request) {
        return ApiResult.ok(userService.updateAvatar(CurrentUser.id(), request.objectKey()));
    }

    public record AvatarRequest(String objectKey) {
    }

    @GetMapping("/{id}")
    public ApiResult<UserView> profile(@PathVariable Long id) {
        return ApiResult.ok(userService.toView(userService.requireById(id)));
    }
}
