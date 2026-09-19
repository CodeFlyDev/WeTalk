package com.wetalk.message.repository;

import com.wetalk.common.MessageType;
import com.wetalk.message.document.MessageDoc;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface MessageRepository extends MongoRepository<MessageDoc, String> {

    Optional<MessageDoc> findFirstByConversationIdAndClientMsgIdOrderByCreatedAtDesc(
            String conversationId, String clientMsgId);

    List<MessageDoc> findTop50ByConversationIdOrderByCreatedAtDesc(String conversationId);

    List<MessageDoc> findTop50ByConversationIdAndCreatedAtLessThanOrderByCreatedAtDesc(
            String conversationId, LocalDateTime before);

    /** 置顶消息列表（时间倒序） */
    List<MessageDoc> findByConversationIdAndPinnedTrueOrderByPinnedAtDesc(String conversationId);

    /** 群文件聚合：群会话内 type=FILE 的消息（最新在前） */
    List<MessageDoc> findTop100ByConversationIdAndTypeOrderByCreatedAtDesc(
            String conversationId, MessageType type);
}
