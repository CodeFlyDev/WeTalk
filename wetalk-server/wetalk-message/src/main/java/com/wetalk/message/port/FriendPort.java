package com.wetalk.message.port;

/**
 * 好友关系防腐接口 —— 由 wetalk-friend 模块实现，message 不直接依赖 friend 实现。
 */
public interface FriendPort {

    boolean areFriends(long userIdA, long userIdB);
}
