package com.wetalk.message.presence;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 未读计数（Redis）：离线时累加，进入会话后由客户端调用清零。
 */
@Service
public class UnreadService {

    private static final String UNREAD_KEY = "wetalk:unread:";

    private final StringRedisTemplate redis;

    public UnreadService(StringRedisTemplate redis) {
        this.redis = redis;
    }

    public void increment(String conversationId, Long userId) {
        redis.opsForValue().increment(UNREAD_KEY + conversationId + ":" + userId);
    }

    public Map<String, Long> batchGet(Long userId, List<String> conversationIds) {
        Map<String, Long> result = new HashMap<>();
        for (String conversationId : conversationIds) {
            String value = redis.opsForValue().get(UNREAD_KEY + conversationId + ":" + userId);
            result.put(conversationId, value == null ? 0L : Long.parseLong(value));
        }
        return result;
    }

    public void clear(Long userId, String conversationId) {
        redis.delete(UNREAD_KEY + conversationId + ":" + userId);
    }
}
