package com.wetalk.social.dto;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 动态视图：作者信息 + 内容 + 图片 + 点赞/评论（feed 一次性带出评论，前 50 条）
 */
public record PostView(
        Long id,
        Long authorId,
        String authorName,
        String authorAvatar,
        String content,
        List<String> imageKeys,
        LocalDateTime createdAt,
        long likeCount,
        boolean likedByMe,
        List<CommentView> comments) {

    public record CommentView(Long id, Long userId, String userName, String content, LocalDateTime createdAt) {
    }
}
