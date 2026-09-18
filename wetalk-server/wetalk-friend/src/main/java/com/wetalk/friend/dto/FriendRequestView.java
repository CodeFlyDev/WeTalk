package com.wetalk.friend.dto;

import com.wetalk.user.dto.UserView;

import java.time.LocalDateTime;

public record FriendRequestView(
        Long id,
        UserView fromUser,
        String remark,
        String status,
        LocalDateTime createdAt) {
}
