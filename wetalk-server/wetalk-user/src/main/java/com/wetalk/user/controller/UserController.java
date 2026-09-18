package com.wetalk.user.controller;

import com.wetalk.common.ApiResult;
import com.wetalk.user.dto.UserView;
import com.wetalk.user.service.UserService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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

    @GetMapping("/{id}")
    public ApiResult<UserView> profile(@PathVariable Long id) {
        return ApiResult.ok(userService.toView(userService.requireById(id)));
    }
}
