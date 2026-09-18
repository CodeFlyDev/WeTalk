package com.wetalk.auth.dto;

import com.wetalk.user.dto.UserView;

public record TokenResponse(
        String accessToken,
        String refreshToken,
        long expiresIn,
        UserView user) {
}
