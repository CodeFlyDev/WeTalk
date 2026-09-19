package com.wetalk.common;

/**
 * 消息类型枚举 —— 对齐 Task.md · 消息协议 v2
 */
public enum MessageType {
    TEXT,        IMAGE,       FILE,        VOICE,
    VIDEO,       EMOJI,       LOCATION,    CARD,
    SYSTEM,      RECALL,      READ_ACK,    TYPING,
    CALL_OFFER,  CALL_ANSWER, CALL_ICE,    CALL_END,
    TRANSFER,    RED_PACKET,  VOTE,        WHITEBOARD
}
