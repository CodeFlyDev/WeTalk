package com.wetalk.group.dto;

import java.time.LocalDateTime;
import java.util.List;

public record GroupView(
        Long id,
        String name,
        Long ownerId,
        String avatarUrl,
        String announcement,
        LocalDateTime createdAt,
        List<MemberView> members) {

    public record MemberView(Long userId, String username, String nickname, String role) {
    }
}
