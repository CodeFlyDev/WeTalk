package com.wetalk.social.controller;

import com.wetalk.auth.security.CurrentUser;
import com.wetalk.common.ApiResult;
import com.wetalk.social.dto.PostView;
import com.wetalk.social.service.PostService;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 朋友圈 REST（t_post / t_post_like / t_post_comment 由 JPA ddl-auto 自动建表）
 */
@RestController
@RequestMapping("/api/posts")
public class PostController {

    private final PostService postService;

    public PostController(PostService postService) {
        this.postService = postService;
    }

    public record PublishRequest(String content, List<String> imageKeys) {
    }

    public record CommentRequest(String content) {
    }

    /** 发布动态（文字 + 图片 objectKey 列表，图片走 MinIO presign 直传） */
    @PostMapping
    public ApiResult<PostView> publish(@org.springframework.validation.annotation.Validated
                                       @RequestBody PublishRequest request) {
        return ApiResult.ok(postService.publish(CurrentUser.id(), request.content(), request.imageKeys()));
    }

    /** 好友圈 feed（好友 + 自己，最新 20 条） */
    @GetMapping("/feed")
    public ApiResult<List<PostView>> feed() {
        return ApiResult.ok(postService.feed(CurrentUser.id()));
    }

    /** 单条详情（评论刷新） */
    @GetMapping("/{id}")
    public ApiResult<PostView> detail(@PathVariable Long id) {
        return ApiResult.ok(postService.detail(CurrentUser.id(), id));
    }

    /** 删除自己的动态 */
    @DeleteMapping("/{id}")
    public ApiResult<Void> delete(@PathVariable Long id) {
        postService.delete(CurrentUser.id(), id);
        return ApiResult.ok(null);
    }

    /** 点赞（幂等） */
    @PostMapping("/{id}/like")
    public ApiResult<Void> like(@PathVariable Long id) {
        postService.like(CurrentUser.id(), id);
        return ApiResult.ok(null);
    }

    /** 取消点赞（幂等） */
    @org.springframework.web.bind.annotation.DeleteMapping("/{id}/like")
    public ApiResult<Void> unlike(@PathVariable Long id) {
        postService.unlike(CurrentUser.id(), id);
        return ApiResult.ok(null);
    }

    /** 评论 */
    @PostMapping("/{id}/comments")
    public ApiResult<PostView> comment(@PathVariable Long id, @RequestBody CommentRequest request) {
        return ApiResult.ok(postService.comment(CurrentUser.id(), id, request.content()));
    }
}
