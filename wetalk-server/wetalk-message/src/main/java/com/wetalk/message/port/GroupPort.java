package com.wetalk.message.port;

import java.util.List;

/**
 * 群成员防腐接口 —— 由 wetalk-group 模块实现。
 */
public interface GroupPort {

    boolean isMember(long groupId, long userId);

    List<Long> memberIds(long groupId);

    /** 用户所在的全部群 ID（全局搜索用） */
    List<Long> myGroupIds(long userId);
}
