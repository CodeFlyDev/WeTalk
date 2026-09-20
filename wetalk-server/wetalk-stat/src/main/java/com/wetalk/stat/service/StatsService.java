package com.wetalk.stat.service;

import com.wetalk.group.repository.GroupRepository;
import com.wetalk.message.repository.MessageRepository;
import com.wetalk.user.repository.UserAccountRepository;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** 数据统计：概览计数（MySQL/Mongo count）+ 近 7 天消息趋势（Mongo 聚合） */
@Service
public class StatsService {

    private final UserAccountRepository userRepository;
    private final GroupRepository groupRepository;
    private final MessageRepository messageRepository;
    private final MongoTemplate mongoTemplate;

    public StatsService(UserAccountRepository userRepository,
                        GroupRepository groupRepository,
                        MessageRepository messageRepository,
                        MongoTemplate mongoTemplate) {
        this.userRepository = userRepository;
        this.groupRepository = groupRepository;
        this.messageRepository = messageRepository;
        this.mongoTemplate = mongoTemplate;
    }

    public Map<String, Long> overview() {
        LocalDateTime todayStart = LocalDate.now().atStartOfDay();
        long todayMessages = mongoTemplate.count(
                org.springframework.data.mongodb.core.query.Query.query(
                        Criteria.where("createdAt").gte(todayStart)), "messages");
        Map<String, Long> result = new LinkedHashMap<>();
        result.put("users", userRepository.count());
        result.put("groups", groupRepository.count());
        result.put("messages", messageRepository.count());
        result.put("todayMessages", todayMessages);
        return result;
    }

    /** 近 7 天每日消息数（含今天，缺失日补 0），按日升序 */
    public List<DayCount> trend7Days() {
        LocalDateTime since = LocalDate.now().minusDays(6).atStartOfDay();
        // Spring Data MongoDB 4.4 移除了 DateToString Aggregation API，
        // 改用 raw MongoDatabase.aggregate 管道
        Map<String, Long> byDay = new LinkedHashMap<>();
        try {
            var db = mongoTemplate.getDb();
            List<org.bson.Document> pipeline = List.of(
                    new org.bson.Document("$match", new org.bson.Document("createdAt",
                            new org.bson.Document("$gte", since.atZone(java.time.ZoneId.systemDefault()).toInstant()))),
                    new org.bson.Document("$project", new org.bson.Document("day",
                            new org.bson.Document("$dateToString", new org.bson.Document("format", "%Y-%m-%d")
                                    .append("date", "$createdAt")))),
                    new org.bson.Document("$group", new org.bson.Document("_id", "$day")
                            .append("count", new org.bson.Document("$sum", 1))),
                    new org.bson.Document("$sort", new org.bson.Document("_id", 1)));
            db.getCollection("messages").aggregate(pipeline).forEach(doc -> {
                String day = doc.getString("_id");
                long count = doc.getLong("count");
                byDay.put(day, count);
            });
        } catch (Exception e) {
            // DB 不可用时返回全 0（API 降级）
        }
        return LocalDate.now().minusDays(6).datesUntil(LocalDate.now().plusDays(1))
                .map(d -> new DayCount(d.toString(), byDay.getOrDefault(d.toString(), 0L)))
                .toList();
    }

    /** 聚合投影 */
    public static class DayCount {
        private String day;
        private long count;

        public DayCount() {
        }

        public DayCount(String day, long count) {
            this.day = day;
            this.count = count;
        }

        public String getDay() { return day; }
        public void setDay(String day) { this.day = day; }
        public long getCount() { return count; }
        public void setCount(long count) { this.count = count; }
    }
}
