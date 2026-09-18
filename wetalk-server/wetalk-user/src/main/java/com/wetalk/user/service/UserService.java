package com.wetalk.user.service;

import com.wetalk.common.BizException;
import com.wetalk.common.ErrorCode;
import com.wetalk.user.dto.UserView;
import com.wetalk.user.entity.UserAccount;
import com.wetalk.user.repository.UserAccountRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 用户领域服务 —— 供 auth / friend / group 等模块调用（模块化单体：本地方法调用）
 */
@Service
public class UserService {

    private final UserAccountRepository repository;

    public UserService(UserAccountRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public UserAccount createUser(String username, String passwordHash, String nickname) {
        if (repository.existsByUsername(username)) {
            throw new BizException(ErrorCode.USERNAME_TAKEN, "用户名已存在: " + username);
        }
        UserAccount user = new UserAccount();
        user.setUsername(username);
        user.setPasswordHash(passwordHash);
        user.setNickname(nickname == null || nickname.isBlank() ? username : nickname);
        return repository.save(user);
    }

    @Transactional(readOnly = true)
    public UserAccount requireById(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new BizException(ErrorCode.USER_NOT_FOUND, "用户不存在: " + id));
    }

    @Transactional(readOnly = true)
    public UserAccount findByUsername(String username) {
        return repository.findByUsername(username)
                .orElseThrow(() -> new BizException(ErrorCode.USER_NOT_FOUND, "用户名或密码错误"));
    }

    @Transactional(readOnly = true)
    public boolean existsById(Long id) {
        return repository.existsById(id);
    }

    @Transactional(readOnly = true)
    public UserView toView(UserAccount user) {
        return new UserView(user.getId(), user.getUsername(), user.getNickname(), user.getAvatarUrl());
    }
}
