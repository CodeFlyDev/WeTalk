package com.wetalk.message.presence;

import com.wetalk.common.port.PresencePort;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.List;

/**
 * 在线状态（Redis）：WebSocket 连接建立写入，断开移除，心跳续期。
 * P0 单实例（模块化单体）在线表；Phase 3 多实例时升级为网关路由表。
 */
@Service
public class PresenceService implements PresencePort {

    private static final String ONLINE_KEY = "wetalk:online:";
    private static final Duration ONLINE_TTL = Duration.ofSeconds(300);

    private final StringRedisTemplate redis;

    public PresenceService(StringRedisTemplate redis) {
        this.redis = redis;
    }

    public void online(Long userId, String sessionId) {
        redis.opsForValue().set(ONLINE_KEY + userId, sessionId, ONLINE_TTL);
    }

    /** 心跳续期 */
    public void refresh(Long userId) {
        redis.expire(ONLINE_KEY + userId, ONLINE_TTL);
    }

    public void offline(Long userId, String sessionId) {
        String key = ONLINE_KEY + userId;
        // 只清掉本连接写入的状态，避免多连接场景误删其他会话的在线标记
        if (sessionId.equals(redis.opsForValue().get(key))) {
            redis.delete(key);
        }
    }

    @Override
    public boolean isOnline(Long userId) {
        return Boolean.TRUE.equals(redis.hasKey(ONLINE_KEY + userId));
    }

    public List<Long> filterOnline(List<Long> userIds) {
        return userIds.stream().filter(this::isOnline).toList();
    }
}
