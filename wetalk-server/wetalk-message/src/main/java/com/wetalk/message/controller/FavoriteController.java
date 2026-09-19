package com.wetalk.message.controller;

import com.wetalk.auth.security.CurrentUser;
import com.wetalk.common.ApiResult;
import com.wetalk.message.dto.FavoriteView;
import com.wetalk.message.service.FavoriteService;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 消息收藏 REST：收藏 / 取消 / 列表
 */
@RestController
@RequestMapping("/api/favorites")
public class FavoriteController {

    private final FavoriteService favoriteService;

    public FavoriteController(FavoriteService favoriteService) {
        this.favoriteService = favoriteService;
    }

    /** 收藏一条自己可见的消息（幂等） */
    @PostMapping("/{messageId}")
    public ApiResult<FavoriteView> add(@PathVariable String messageId) {
        return ApiResult.ok(favoriteService.add(CurrentUser.id(), messageId));
    }

    /** 取消收藏（幂等） */
    @DeleteMapping("/{messageId}")
    public ApiResult<Void> remove(@PathVariable String messageId) {
        favoriteService.remove(CurrentUser.id(), messageId);
        return ApiResult.ok(null);
    }

    /** 我的收藏列表（最新在前） */
    @GetMapping
    public ApiResult<List<FavoriteView>> list() {
        return ApiResult.ok(favoriteService.list(CurrentUser.id()));
    }
}
