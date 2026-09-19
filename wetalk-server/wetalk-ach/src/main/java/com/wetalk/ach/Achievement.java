package com.wetalk.ach;

/**
 * 成就定义（代码枚举，不落库）：code = 枚举名，各业务事件点触发解锁。
 */
public enum Achievement {
    WELCOME("欢迎加入", "注册成功，开启 WeTalk 之旅", "🎉"),
    FIRST_MESSAGE("初次问候", "发送第一条消息", "💬"),
    FIRST_GROUP("拉群小能手", "创建第一个群聊", "👥"),
    FIRST_VOICE("语音结缘", "发起第一次语音通话", "🎙️"),
    FIRST_VIDEO("视频相见", "发起第一次视频通话", "📹"),
    FIRST_STICKER("斗图新秀", "发送第一个表情包", "😹"),
    FIRST_RED_PACKET("财源广进", "发出第一个红包", "🧧"),
    FIRST_POST("朋友圈首发", "发布第一条动态", "📸");

    private final String title;
    private final String description;
    private final String emoji;

    Achievement(String title, String description, String emoji) {
        this.title = title;
        this.description = description;
        this.emoji = emoji;
    }

    public String getTitle() {
        return title;
    }

    public String getDescription() {
        return description;
    }

    public String getEmoji() {
        return emoji;
    }

    public String getCode() {
        return name();
    }

    /** 宽容解析：未知 code 返回 null（旧客户端/事件拼写变化不抛异常） */
    public static Achievement valueOfSafe(String code) {
        try {
            return valueOf(code);
        } catch (IllegalArgumentException | NullPointerException e) {
            return null;
        }
    }
}
