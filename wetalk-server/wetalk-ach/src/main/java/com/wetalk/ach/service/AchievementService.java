package com.wetalk.ach.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wetalk.ach.Achievement;
import com.wetalk.ach.entity.UserAchievement;
import com.wetalk.ach.repository.UserAchievementRepository;
import com.wetalk.message.presence.PresenceService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 成就解锁（幂等）：Redis SSET 短路高频重复事件，未命中才查库/落库；
 * Redis 异常静默降级为直查 MySQL（不影响业务主链路）。
 * 首次解锁推送 /user/queue/notify event=ACHIEVEMENT（data = JSON 字符串）。
 */
@Service
public class AchievementService {

    private static final Logger log = LoggerFactory.getLogger(AchievementService.class);

    public static final String QUEUE_NOTIFY = "/queue/notify";

    /** Redis 已解锁集合 key 前缀：ach:u:{userId} → members = code */
    private static final String REDIS_KEY = "ach:u:";

    private final UserAchievementRepository repository;
    private final StringRedisTemplate redis;
    private final SimpMessagingTemplate messagingTemplate;
    private final ObjectMapper objectMapper;
    private final PresenceService presenceService;

    public AchievementService(UserAchievementRepository repository,
                              StringRedisTemplate redis,
                              SimpMessagingTemplate messagingTemplate,
                              ObjectMapper objectMapper,
                              PresenceService presenceService) {
        this.repository = repository;
        this.redis = redis;
        this.messagingTemplate = messagingTemplate;
        this.objectMapper = objectMapper;
        this.presenceService = presenceService;
    }

    /** 解锁成就（幂等，可任意次触发）：首次落库 + 在线推送 */
    public void unlock(Long userId, String code) {
        if (userId == null || code == null || Achievement.valueOfSafe(code) == null) {
            return;
        }
        if (alreadyUnlocked(userId, code)) {
            return;
        }
        try {
            repository.save(achievementOf(userId, code));
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            // 并发双解锁：唯一约束兜底
            return;
        }
        markUnlockedInRedis(userId, code);
        notify(userId, Achievement.valueOfSafe(code));
        log.info("achievement unlocked, user={}, code={}", userId, code);
    }

    /** 我的成就列表：全部定义 + 解锁状态/时间 */
    public List<Map<String, Object>> listMine(Long userId) {
        Map<String, UserAchievement> mine = new HashMap<>();
        for (UserAchievement ua : repository.findByUserId(userId)) {
            mine.put(ua.getCode(), ua);
        }
        List<Map<String, Object>> result = new ArrayList<>();
        for (Achievement a : Achievement.values()) {
            UserAchievement ua = mine.get(a.getCode());
            Map<String, Object> item = new HashMap<>();
            item.put("code", a.getCode());
            item.put("title", a.getTitle());
            item.put("description", a.getDescription());
            item.put("emoji", a.getEmoji());
            item.put("unlocked", ua != null);
            item.put("unlockedAt", ua == null ? null : ua.getUnlockedAt().toString());
            result.add(item);
        }
        return result;
    }

    private boolean alreadyUnlocked(Long userId, String code) {
        try {
            Boolean member = redis.opsForSet().isMember(REDIS_KEY + userId, code);
            if (Boolean.TRUE.equals(member)) {
                return true;
            }
        } catch (Exception e) {
            log.warn("ach redis check failed, fallback to db, user={}", userId, e);
        }
        boolean exists = repository.existsByUserIdAndCode(userId, code);
        if (exists) {
            // 回填缓存，下次短路
            markUnlockedInRedis(userId, code);
        }
        return exists;
    }

    private void markUnlockedInRedis(Long userId, String code) {
        try {
            String key = REDIS_KEY + userId;
            redis.opsForSet().add(key, code);
            redis.expire(key, Duration.ofDays(30));
        } catch (Exception e) {
            log.warn("ach redis mark failed (degraded), user={}", userId, e);
        }
    }

    private void notify(Long userId, Achievement achievement) {
        if (!isOnline(userId)) {
            return;
        }
        try {
            Map<String, Object> data = new HashMap<>();
            data.put("code", achievement.getCode());
            data.put("title", achievement.getTitle());
            data.put("description", achievement.getDescription());
            data.put("emoji", achievement.getEmoji());
            Map<String, Object> body = new HashMap<>();
            body.put("event", "ACHIEVEMENT");
            body.put("data", data);
            messagingTemplate.convertAndSendToUser(
                    String.valueOf(userId), QUEUE_NOTIFY, objectMapper.writeValueAsString(body));
        } catch (JsonProcessingException e) {
            log.error("achievement notify serialize failed, code={}", achievement.getCode(), e);
        }
    }

    private boolean isOnline(Long userId) {
        return presenceService.isOnline(userId);
    }

    private UserAchievement achievementOf(Long userId, String code) {
        UserAchievement ua = new UserAchievement();
        ua.setUserId(userId);
        ua.setCode(code);
        return ua;
    }
}
