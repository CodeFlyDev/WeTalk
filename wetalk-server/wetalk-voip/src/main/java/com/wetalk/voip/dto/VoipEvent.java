package com.wetalk.voip.dto;

/**
 * 通话信令事件类型 —— 对齐 Task.md · 消息协议 CALL_* 语义
 */
public enum VoipEvent {
    /** 主叫 → 被叫：呼叫邀请（media=AUDIO/VIDEO） */
    INVITE,
    /** 被叫 → 主叫：接受通话（随后主叫发 OFFER） */
    ACCEPT,
    /** 被叫 → 主叫：拒绝 */
    REJECT,
    /** 主叫 → 被叫：取消呼叫（未接听前） */
    CANCEL,
    /** 被叫忙 → 主叫：忙碌 */
    BUSY,
    /** 服务端 → 主叫：被叫不在线 */
    OFFLINE,
    /** WebRTC SDP Offer / Answer */
    OFFER,
    ANSWER,
    /** ICE 候选（payload = candidate JSON） */
    ICE,
    /** 任一方挂断 */
    END,
    /** 会议：加入广播（groupId = 目标群，media = AUDIO/VIDEO），转发给群内其他在线成员 */
    MEET_JOIN,
    /** 会议：离开广播（groupId = 目标群） */
    MEET_LEAVE,
    /** 服务端 → 客户端：信令被拒（payload = 原因），如非好友 */
    ERROR
}
