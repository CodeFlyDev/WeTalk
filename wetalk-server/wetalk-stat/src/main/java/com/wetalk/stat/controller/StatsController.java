package com.wetalk.stat.controller;

import com.wetalk.common.security.CurrentUser;
import com.wetalk.common.ApiResult;
import com.wetalk.common.BizException;
import com.wetalk.common.ErrorCode;
import com.wetalk.stat.service.StatsService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 数据统计后台（管理员限定）。
 * 管理员判定偏离：无角色体系，按 wetalk.admin-ids 配置（默认用户 ID=1）。
 */
@RestController
@RequestMapping("/api/stats")
public class StatsController {

    private final StatsService statsService;
    private final List<Long> adminIds;

    public StatsController(StatsService statsService,
                           @Value("${wetalk.admin-ids:1}") List<Long> adminIds) {
        this.statsService = statsService;
        this.adminIds = adminIds;
    }

    @GetMapping("/overview")
    public ApiResult<Map<String, Long>> overview() {
        requireAdmin();
        return ApiResult.ok(statsService.overview());
    }

    @GetMapping("/trend")
    public ApiResult<List<StatsService.DayCount>> trend() {
        requireAdmin();
        return ApiResult.ok(statsService.trend7Days());
    }

    private void requireAdmin() {
        if (!adminIds.contains(CurrentUser.id())) {
            throw new BizException(ErrorCode.FORBIDDEN, "仅管理员可查看统计");
        }
    }
}
