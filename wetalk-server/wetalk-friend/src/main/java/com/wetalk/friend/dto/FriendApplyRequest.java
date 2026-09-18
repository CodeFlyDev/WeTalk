package com.wetalk.friend.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record FriendApplyRequest(
        @NotNull Long toUserId,
        @Size(max = 128) String remark) {
}
