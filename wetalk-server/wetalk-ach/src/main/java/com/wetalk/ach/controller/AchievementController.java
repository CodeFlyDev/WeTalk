package com.wetalk.ach.controller;

import com.wetalk.common.security.CurrentUser;
import com.wetalk.common.ApiResult;
import com.wetalk.ach.service.AchievementService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 成就 REST：全部定义 + 我的解锁状态
 */
@RestController
@RequestMapping("/api/achievements")
public class AchievementController {

    private final AchievementService achievementService;

    public AchievementController(AchievementService achievementService) {
        this.achievementService = achievementService;
    }

    @GetMapping
    public ApiResult<List<Map<String, Object>>> mine() {
        return ApiResult.ok(achievementService.listMine(CurrentUser.id()));
    }
}
