package com.wetalk.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank
        @Pattern(regexp = "^[a-zA-Z0-9_]{4,32}$", message = "用户名 4-32 位字母/数字/下划线")
        String username,
        @NotBlank
        @Size(min = 6, max = 64, message = "密码 6-64 位")
        String password,
        @Size(max = 64, message = "昵称最长 64 字符")
        String nickname) {
}
