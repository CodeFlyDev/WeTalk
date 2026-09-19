package com.wetalk.ach.service;

import com.wetalk.common.AchieveEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

/**
 * 成就事件监听：各业务模块 publish AchieveEvent，这里统一消费。
 * 默认同步执行（事件无 IO 前置、unlock 内部 Redis 短路 + 唯一约束幂等），
 * 不用 @Async：避免虚拟线程池被高频消息事件占满的隐性成本。
 */
@Component
public class AchievementListener {

    private final AchievementService achievementService;

    public AchievementListener(AchievementService achievementService) {
        this.achievementService = achievementService;
    }

    @EventListener
    public void on(AchieveEvent event) {
        achievementService.unlock(event.userId(), event.code());
    }
}
