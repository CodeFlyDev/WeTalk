package com.wetalk.auth.service;

import com.wetalk.auth.dto.RegisterRequest;
import com.wetalk.auth.dto.TokenResponse;
import com.wetalk.auth.jwt.JwtTokenService;
import com.wetalk.common.AchieveEvent;
import com.wetalk.common.BizException;
import com.wetalk.common.ErrorCode;
import com.wetalk.user.dto.UserView;
import com.wetalk.user.entity.UserAccount;
import com.wetalk.user.service.UserService;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final UserService userService;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenService jwtTokenService;
    private final ApplicationEventPublisher eventPublisher;

    public AuthService(UserService userService, PasswordEncoder passwordEncoder, JwtTokenService jwtTokenService,
                       ApplicationEventPublisher eventPublisher) {
        this.userService = userService;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenService = jwtTokenService;
        this.eventPublisher = eventPublisher;
    }

    @Transactional
    public TokenResponse register(RegisterRequest request) {
        UserAccount user = userService.createUser(
                request.username(), passwordEncoder.encode(request.password()), request.nickname());
        eventPublisher.publishEvent(new AchieveEvent(user.getId(), "WELCOME"));
        return buildTokenResponse(user);
    }

    public TokenResponse login(String username, String password) {
        UserAccount user = userService.findByUsername(username);
        if (user.getStatus() != null && user.getStatus() != 1) {
            throw new BizException(ErrorCode.FORBIDDEN, "账号已被禁用");
        }
        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new BizException(ErrorCode.UNAUTHORIZED, "用户名或密码错误");
        }
        return buildTokenResponse(user);
    }

    public TokenResponse refresh(String refreshToken) {
        return jwtTokenService.parseRefresh(refreshToken)
                .map(loginUser -> userService.requireById(loginUser.userId()))
                .map(this::buildTokenResponse)
                .orElseThrow(() -> new BizException(ErrorCode.UNAUTHORIZED, "refresh token 无效"));
    }

    public UserView me(Long userId) {
        return userService.toView(userService.requireById(userId));
    }

    private TokenResponse buildTokenResponse(UserAccount user) {
        return new TokenResponse(
                jwtTokenService.issueAccess(user.getId(), user.getUsername()),
                jwtTokenService.issueRefresh(user.getId(), user.getUsername()),
                jwtTokenService.accessExpireSeconds(),
                userService.toView(user));
    }
}
