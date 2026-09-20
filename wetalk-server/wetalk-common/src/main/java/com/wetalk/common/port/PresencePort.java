package com.wetalk.common.port;

/**
 * 在线状态防腐接口 —— 由 wetalk-message 模块实现，ach 等模块不直接依赖 message 实现。
 */
public interface PresencePort {

    boolean isOnline(Long userId);
}
