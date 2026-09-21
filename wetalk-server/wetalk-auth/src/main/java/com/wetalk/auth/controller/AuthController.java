package com.wetalk.auth.controller;

import com.wetalk.auth.dto.LoginRequest;
import com.wetalk.auth.dto.RefreshRequest;
import com.wetalk.auth.dto.RegisterRequest;
import com.wetalk.auth.dto.TokenResponse;
import com.wetalk.common.security.CurrentUser;
import com.wetalk.auth.service.AuthService;
import com.wetalk.common.ApiResult;
import com.wetalk.user.dto.UserView;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 认证接口：注册 / 登录 / 刷新 / 当前用户
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public ApiResult<TokenResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ApiResult.ok(authService.register(request));
    }

    @PostMapping("/login")
    public ApiResult<TokenResponse> login(@Valid @RequestBody LoginRequest request) {
        return ApiResult.ok(authService.login(request.username(), request.password()));
    }

    @PostMapping("/refresh")
    public ApiResult<TokenResponse> refresh(@Valid @RequestBody RefreshRequest request) {
        return ApiResult.ok(authService.refresh(request.refreshToken()));
    }

    @GetMapping("/me")
    public ApiResult<UserView> me() {
        return ApiResult.ok(authService.me(CurrentUser.id()));
    }
}
