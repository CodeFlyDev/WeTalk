package com.wetalk.common;

/**
 * 成就解锁事件（Spring 应用事件，各业务模块 publish、wetalk-ach 监听消费）。
 * 放 common 底座：业务模块无需新增模块间依赖即可触发成就。
 * 监听侧幂等（Redis 缓存 + 唯一约束），事件允许多发。
 */
public record AchieveEvent(Long userId, String code) {
}
