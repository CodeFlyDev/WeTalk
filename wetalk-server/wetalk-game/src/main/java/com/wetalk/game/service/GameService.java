package com.wetalk.game.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wetalk.game.dto.GameRequest;
import com.wetalk.message.port.FriendPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 五子棋对局服务（单聊限定）：内存对局状态（重启丢局，语义即「娱乐局」），
 * 事件经 /user/{id}/queue/notify 推 GAME 事件（FriendNotifier 范式）。
 * 棋盘 15×15：idx = row*15+col，color 1=黑（先手=邀请方）2=白。
 */
@Service
public class GameService {

    private static final Logger log = LoggerFactory.getLogger(GameService.class);
    private static final int SIZE = 15;
    private static final int EMPTY = 0;
    private static final int BLACK = 1;
    private static final int WHITE = 2;

    private final FriendPort friendPort;
    private final SimpMessagingTemplate messagingTemplate;
    private final ObjectMapper objectMapper;

    /** conversationId → 对局（同会话同时一局） */
    private final Map<String, GameSession> sessions = new ConcurrentHashMap<>();

    public GameService(FriendPort friendPort,
                       SimpMessagingTemplate messagingTemplate,
                       ObjectMapper objectMapper) {
        this.friendPort = friendPort;
        this.messagingTemplate = messagingTemplate;
        this.objectMapper = objectMapper;
    }

    /** 一局棋的内存状态 */
    static class GameSession {
        final String gameId = UUID.randomUUID().toString();
        final String conversationId;
        final Long blackId;
        volatile Long whiteId;
        volatile String status = "INVITING";
        volatile int turn = BLACK;
        volatile Long winnerId;
        final int[] board = new int[SIZE * SIZE];

        GameSession(String conversationId, Long blackId) {
            this.conversationId = conversationId;
            this.blackId = blackId;
        }

        boolean participant(Long userId) {
            return userId.equals(blackId) || userId.equals(whiteId);
        }
    }

    public void handle(Long userId, GameRequest request) {
        if (request.conversationId() == null || !request.conversationId().startsWith("dm:")) {
            return; // 五子棋仅限单聊
        }
        Long peerId = peerOf(request.conversationId(), userId);
        if (peerId == null) {
            return;
        }
        switch (request.event() == null ? "" : request.event()) {
            case "INVITE" -> invite(userId, peerId, request);
            case "ACCEPT" -> accept(userId, request);
            case "REJECT" -> reject(userId, request);
            case "CANCEL" -> cancel(userId, request);
            case "MOVE" -> move(userId, request);
            case "RESIGN" -> resign(userId, request);
            default -> log.debug("unknown game event: {}", request.event());
        }
    }

    private void invite(Long userId, Long peerId, GameRequest request) {
        if (!friendPort.areFriends(userId, peerId)) {
            return;
        }
        GameSession existing = sessions.get(request.conversationId());
        if (existing != null && !"FINISHED".equals(existing.status)) {
            return; // 已有进行中对局
        }
        GameSession session = new GameSession(request.conversationId(), userId);
        session.whiteId = peerId; // 邀请阶段即记录被邀请人（ACCEPT 确认 / REJECT·CANCEL 通知用）
        sessions.put(request.conversationId(), session);
        send(peerId, Map.of(
                "action", "INVITE",
                "conversationId", session.conversationId,
                "gameId", session.gameId,
                "from", userId));
    }

    private void accept(Long userId, GameRequest request) {
        GameSession session = sessions.get(request.conversationId());
        if (session == null || !"INVITING".equals(session.status)
                || !session.gameId.equals(request.gameId())
                || session.blackId.equals(userId)) {
            return;
        }
        session.whiteId = userId;
        session.status = "PLAYING";
        send(session.blackId, startData(session, "BLACK"));
        send(userId, startData(session, "WHITE"));
    }

    private void reject(Long userId, GameRequest request) {
        GameSession session = sessions.get(request.conversationId());
        if (session == null || !"INVITING".equals(session.status)
                || !session.gameId.equals(request.gameId())) {
            return;
        }
        sessions.remove(session.conversationId);
        send(session.blackId, Map.of(
                "action", "REJECT", "conversationId", session.conversationId, "gameId", session.gameId));
    }

    private void cancel(Long userId, GameRequest request) {
        GameSession session = sessions.get(request.conversationId());
        if (session == null || !"INVITING".equals(session.status)
                || !session.gameId.equals(request.gameId())
                || !session.blackId.equals(userId)) {
            return;
        }
        sessions.remove(session.conversationId);
        if (session.whiteId != null) {
            send(session.whiteId, Map.of(
                    "action", "CANCEL", "conversationId", session.conversationId, "gameId", session.gameId));
        }
    }

    private void move(Long userId, GameRequest request) {
        GameSession session = sessions.get(request.conversationId());
        if (session == null || !"PLAYING".equals(session.status)
                || !session.gameId.equals(request.gameId())
                || !session.participant(userId)
                || request.idx() == null || request.idx() < 0 || request.idx() >= session.board.length) {
            return;
        }
        int color = userId.equals(session.blackId) ? BLACK : WHITE;
        if (session.turn != color || session.board[request.idx()] != EMPTY) {
            return; // 非本方回合 / 已有棋子
        }
        session.board[request.idx()] = color;
        boolean win = isWin(session.board, request.idx(), color);
        Long nextId = color == BLACK ? session.whiteId : session.blackId;
        if (win) {
            session.status = "FINISHED";
            session.winnerId = userId;
        }
        Map<String, Object> data = new HashMap<>();
        data.put("action", "MOVE");
        data.put("conversationId", session.conversationId);
        data.put("gameId", session.gameId);
        data.put("idx", request.idx());
        data.put("color", color == BLACK ? "BLACK" : "WHITE");
        data.put("win", win);
        data.put("winnerId", session.winnerId);
        if (!win) {
            data.put("nextId", nextId);
        }
        send(session.blackId, data);
        send(session.whiteId, data);
    }

    private void resign(Long userId, GameRequest request) {
        GameSession session = sessions.get(request.conversationId());
        if (session == null || !"PLAYING".equals(session.status)
                || !session.gameId.equals(request.gameId())
                || !session.participant(userId)) {
            return;
        }
        session.status = "FINISHED";
        session.winnerId = userId.equals(session.blackId) ? session.whiteId : session.blackId;
        Map<String, Object> data = Map.of(
                "action", "GAME_OVER",
                "conversationId", session.conversationId,
                "gameId", session.gameId,
                "winnerId", session.winnerId,
                "reason", "RESIGN");
        send(session.blackId, data);
        send(session.whiteId, data);
    }

    /* ---------- 内部 ---------- */

    /** dm:a:b → operator 的对方 */
    private static Long peerOf(String conversationId, Long operatorId) {
        String[] parts = conversationId.substring(3).split(":");
        try {
            long a = Long.parseLong(parts[0]);
            long b = Long.parseLong(parts[1]);
            if (operatorId == a) return b;
            if (operatorId == b) return a;
            return null;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static Map<String, Object> startData(GameSession session, String myColor) {
        return Map.of(
                "action", "START",
                "conversationId", session.conversationId,
                "gameId", session.gameId,
                "blackId", session.blackId,
                "whiteId", session.whiteId,
                "myColor", myColor);
    }

    /** 五连判定：4 方向双向扫描 */
    private static boolean isWin(int[] board, int idx, int color) {
        int row = idx / SIZE;
        int col = idx % SIZE;
        int[][] dirs = {{0, 1}, {1, 0}, {1, 1}, {1, -1}};
        for (int[] d : dirs) {
            int count = 1;
            for (int sign : new int[]{1, -1}) {
                int r = row + d[0] * sign;
                int c = col + d[1] * sign;
                while (r >= 0 && r < SIZE && c >= 0 && c < SIZE && board[r * SIZE + c] == color) {
                    count++;
                    r += d[0] * sign;
                    c += d[1] * sign;
                }
            }
            if (count >= 5) {
                return true;
            }
        }
        return false;
    }

    private void send(Long userId, Map<String, Object> data) {
        try {
            Map<String, Object> body = new HashMap<>();
            body.put("event", "GAME");
            body.put("data", data);
            messagingTemplate.convertAndSendToUser(
                    String.valueOf(userId), "/queue/notify", objectMapper.writeValueAsString(body));
        } catch (JsonProcessingException e) {
            log.error("game notify serialize failed", e);
        }
    }

    /** 调试用：存活对局数 */
    public int activeSessions() {
        return (int) sessions.values().stream().filter(s -> Arrays.stream(s.board).anyMatch(v -> v != EMPTY)).count();
    }
}
