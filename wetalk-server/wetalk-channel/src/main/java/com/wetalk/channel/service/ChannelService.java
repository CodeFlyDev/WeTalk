package com.wetalk.channel.service;

import com.wetalk.channel.entity.Channel;
import com.wetalk.channel.entity.ChannelMember;
import com.wetalk.channel.mongo.ChannelMessageDoc;
import com.wetalk.channel.mongo.ChannelMessageRepository;
import com.wetalk.channel.repository.ChannelMemberRepository;
import com.wetalk.channel.repository.ChannelRepository;
import com.wetalk.common.BizException;
import com.wetalk.common.ErrorCode;
import com.wetalk.user.service.UserService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 频道领域服务：公开频道 CRUD + 加入/退出 + 文字消息流（Mongo + /topic/channel.{id} 广播）。
 */
@Service
public class ChannelService {

    private static final Logger log = LoggerFactory.getLogger(ChannelService.class);

    private static final int HISTORY_SIZE = 50;

    private final ChannelRepository channelRepository;
    private final ChannelMemberRepository memberRepository;
    private final ChannelMessageRepository messageRepository;
    private final UserService userService;
    private final SimpMessagingTemplate messagingTemplate;
    private final ObjectMapper objectMapper;

    public ChannelService(ChannelRepository channelRepository,
                          ChannelMemberRepository memberRepository,
                          ChannelMessageRepository messageRepository,
                          UserService userService,
                          SimpMessagingTemplate messagingTemplate,
                          ObjectMapper objectMapper) {
        this.channelRepository = channelRepository;
        this.memberRepository = memberRepository;
        this.messageRepository = messageRepository;
        this.userService = userService;
        this.messagingTemplate = messagingTemplate;
        this.objectMapper = objectMapper;
    }

    /* ---------- 频道管理 ---------- */

    @Transactional
    public Map<String, Object> create(Long userId, String name, String description) {
        Channel channel = new Channel();
        channel.setName(name.trim());
        channel.setDescription(description == null ? "" : description.strip());
        channel.setOwnerId(userId);
        channel = channelRepository.save(channel);
        memberRepository.save(memberOf(channel.getId(), userId));
        return toView(channel, userId);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> list(Long userId) {
        // 我加入的频道 id 集合（一次查询，避免 N+1 joined 判断）
        Map<Long, Boolean> joinedMap = new HashMap<>();
        for (ChannelMember m : memberRepository.findByUserId(userId)) {
            joinedMap.put(m.getChannelId(), true);
        }
        List<Map<String, Object>> result = new ArrayList<>();
        for (Channel channel : channelRepository.findAll()) {
            result.add(toView(channel, userId, joinedMap.containsKey(channel.getId())));
        }
        // 我加入的在前，其余按创建时间倒序
        result.sort((a, b) -> {
            boolean ja = (Boolean) a.get("joined");
            boolean jb = (Boolean) b.get("joined");
            if (ja != jb) return ja ? -1 : 1;
            return ((String) b.get("createdAt")).compareTo((String) a.get("createdAt"));
        });
        return result;
    }

    @Transactional
    public void join(Long userId, Long channelId) {
        requireChannel(channelId);
        if (!memberRepository.existsByChannelIdAndUserId(channelId, userId)) {
            memberRepository.save(memberOf(channelId, userId));
        }
    }

    @Transactional
    public void quit(Long userId, Long channelId) {
        Channel channel = requireChannel(channelId);
        if (channel.getOwnerId().equals(userId)) {
            throw new BizException(ErrorCode.BIZ_ERROR, "频道主不能退出，可先解散频道");
        }
        memberRepository.deleteByChannelIdAndUserId(channelId, userId);
    }

    @Transactional
    public void dissolve(Long userId, Long channelId) {
        Channel channel = requireChannel(channelId);
        if (!channel.getOwnerId().equals(userId)) {
            throw new BizException(ErrorCode.FORBIDDEN, "仅频道主可解散");
        }
        memberRepository.deleteByChannelId(channelId);
        channelRepository.delete(channel);
    }

    /* ---------- 消息流 ---------- */

    /** 发送消息（仅成员）：REST 发送（同步拿到 view 上屏）→ 存 Mongo → /topic/channel.{id} 广播 */
    public Map<String, Object> send(Long userId, Long channelId, String content) {
        requireChannel(channelId);
        if (!memberRepository.existsByChannelIdAndUserId(channelId, userId)) {
            throw new BizException(ErrorCode.FORBIDDEN, "加入频道后才能发言");
        }
        String text = content == null ? "" : content.strip();
        if (text.isEmpty()) {
            throw new BizException(ErrorCode.BAD_REQUEST, "消息不能为空");
        }

        ChannelMessageDoc doc = new ChannelMessageDoc();
        doc.setChannelId(channelId);
        doc.setSenderId(userId);
        doc.setContent(text.length() > 2000 ? text.substring(0, 2000) : text);
        doc.setCreatedAt(LocalDateTime.now());
        messageRepository.save(doc);

        Map<String, Object> view = toMessageView(doc);
        broadcast(channelId, view);
        return view;
    }

    /** 历史消息（最近 50 条，正序返回） */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> history(Long userId, Long channelId) {
        requireChannel(channelId);
        List<ChannelMessageDoc> docs =
                messageRepository.findByChannelIdOrderByCreatedAtDesc(channelId, PageRequest.of(0, HISTORY_SIZE));
        List<Map<String, Object>> result = new ArrayList<>();
        for (int i = docs.size() - 1; i >= 0; i--) {
            result.add(toMessageView(docs.get(i)));
        }
        return result;
    }

    /* ---------- 内部 ---------- */

    private void broadcast(Long channelId, Map<String, Object> view) {
        try {
            messagingTemplate.convertAndSend("/topic/channel." + channelId, objectMapper.writeValueAsString(view));
        } catch (JsonProcessingException e) {
            log.error("channel message serialize failed, channel={}", channelId, e);
        }
    }

    private Map<String, Object> toMessageView(ChannelMessageDoc doc) {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("id", doc.getId());
        view.put("channelId", doc.getChannelId());
        view.put("senderId", doc.getSenderId());
        String senderName;
        try {
            var user = userService.requireById(doc.getSenderId());
            senderName = user.getNickname() == null || user.getNickname().isBlank()
                    ? user.getUsername() : user.getNickname();
        } catch (Exception e) {
            senderName = "用户 " + doc.getSenderId();
        }
        view.put("senderName", senderName);
        view.put("content", doc.getContent());
        view.put("createdAt", doc.getCreatedAt().toString());
        return view;
    }

    private Map<String, Object> toView(Channel channel, Long userId) {
        return toView(channel, userId, memberRepository.existsByChannelIdAndUserId(channel.getId(), userId));
    }

    private Map<String, Object> toView(Channel channel, Long userId, boolean joined) {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("id", channel.getId());
        view.put("name", channel.getName());
        view.put("description", channel.getDescription());
        view.put("ownerId", channel.getOwnerId());
        view.put("ownerName", userService.toView(userService.requireById(channel.getOwnerId())).nickname());
        view.put("memberCount", memberRepository.countByChannelId(channel.getId()));
        view.put("joined", joined);
        view.put("isOwner", channel.getOwnerId().equals(userId));
        view.put("createdAt", channel.getCreatedAt().toString());
        return view;
    }

    private Channel requireChannel(Long channelId) {
        return channelRepository.findById(channelId)
                .orElseThrow(() -> new BizException(ErrorCode.NOT_FOUND, "频道不存在: " + channelId));
    }

    private ChannelMember memberOf(Long channelId, Long userId) {
        ChannelMember member = new ChannelMember();
        member.setChannelId(channelId);
        member.setUserId(userId);
        return member;
    }
}
