package com.wetalk.group.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

public record CreateGroupRequest(
        @NotBlank @Size(max = 64) String name,
        @Size(max = 512) String avatarUrl,
        List<Long> memberIds) {
}
