package com.wetalk.file.dto;

public record PresignResult(
        String objectKey,
        String uploadUrl,
        long uploadExpireSeconds) {
}
