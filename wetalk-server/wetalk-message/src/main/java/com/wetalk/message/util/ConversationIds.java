package com.wetalk.message.util;

/**
 * 会话 ID 规则：单聊 dm:{minUserId}:{maxUserId}；群聊 g:{groupId}
 */
public final class ConversationIds {

    private static final String DM_PREFIX = "dm:";
    private static final String GROUP_PREFIX = "g:";

    private ConversationIds() {
    }

    public static String directMessage(long userA, long userB) {
        return DM_PREFIX + Math.min(userA, userB) + ":" + Math.max(userA, userB);
    }

    public static String group(long groupId) {
        return GROUP_PREFIX + groupId;
    }

    public static boolean isGroup(String conversationId) {
        return conversationId != null && conversationId.startsWith(GROUP_PREFIX);
    }
}
