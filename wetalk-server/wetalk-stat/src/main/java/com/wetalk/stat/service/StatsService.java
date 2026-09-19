package com.wetalk.stat.service;

import com.wetalk.group.repository.GroupRepository;
import com.wetalk.message.repository.MessageRepository;
import com.wetalk.user.repository.UserAccountRepository;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.DateOperators;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.springframework.data.mongodb.core.aggregation.Aggregation.group;
import static org.springframework.data.mongodb.core.aggregation.Aggregation.match;
import static org.springframework.data.mongodb.core.aggregation.Aggregation.newAggregation;
import static org.springframework.data.mongodb.core.aggregation.Aggregation.project;
import static org.springframework.data.mongodb.core.aggregation.Aggregation.sort;

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
        Aggregation aggregation = newAggregation(
                match(Criteria.where("createdAt").gte(since)),
                project().and(DateOperators.DateToString.dateToStringOf("createdAt")
                        .format("%Y-%m-%d")
                        .withTimezone(DateOperators.Timezone.valueOf("+08:00"))).as("day"),
                group("day").count().as("count"),
                project("count").and("_id").as("day"),
                sort(Sort.Direction.ASC, "day"));
        Map<String, Long> byDay = new LinkedHashMap<>();
        mongoTemplate.aggregate(aggregation, "messages", DayCount.class)
                .getMappedResults()
                .forEach(dc -> byDay.put(dc.getDay(), dc.getCount()));
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
