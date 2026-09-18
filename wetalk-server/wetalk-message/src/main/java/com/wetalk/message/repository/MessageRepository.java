package com.wetalk.message.repository;

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
}
