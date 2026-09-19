package com.wetalk.game.dto;

/**
 * 五子棋对局信令（WS /app/game）：
 * event = INVITE | ACCEPT | REJECT | CANCEL | MOVE | RESIGN
 */
public record GameRequest(
        String conversationId,
        String event,
        String gameId,
        Integer idx) {
}
