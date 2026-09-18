package com.wetalk.message.port;

import java.util.List;

/**
 * 群成员防腐接口 —— 由 wetalk-group 模块实现。
 */
public interface GroupPort {

    boolean isMember(long groupId, long userId);

    List<Long> memberIds(long groupId);
}
