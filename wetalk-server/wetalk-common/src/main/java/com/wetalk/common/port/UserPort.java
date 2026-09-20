package com.wetalk.common.port;

/**
 * 用户防腐接口 —— 由 wetalk-user 模块实现，message 等模块不直接依赖 user 实现。
 */
public interface UserPort {

    boolean existsById(Long id);
}
