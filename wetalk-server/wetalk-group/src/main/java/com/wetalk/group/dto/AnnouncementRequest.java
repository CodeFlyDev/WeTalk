package com.wetalk.group.dto;

import jakarta.validation.constraints.Size;

/**
 * 群公告更新请求（置空即清除公告）
 */
public record AnnouncementRequest(@Size(max = 1024, message = "公告最长 1024 字符") String announcement) {
}
