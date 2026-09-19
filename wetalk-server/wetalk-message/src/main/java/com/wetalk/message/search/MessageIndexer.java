package com.wetalk.message.search;

import com.wetalk.message.document.MessageDoc;
import com.wetalk.message.dto.MessageView;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Sort;
import org.springframework.data.elasticsearch.client.elc.NativeQuery;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.data.elasticsearch.core.SearchHit;
import org.springframework.data.elasticsearch.core.SearchHits;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * ES 索引器：发送时双写、撤回时删档、会话内全文检索。
 * 所有操作静默降级（try-catch），ES 不可用不影响消息主链路。
 */
@Service
public class MessageIndexer {

    private static final Logger log = LoggerFactory.getLogger(MessageIndexer.class);

    private final ElasticsearchOperations operations;
    private final MessageSearchRepository repository;

    public MessageIndexer(ElasticsearchOperations operations, MessageSearchRepository repository) {
        this.operations = operations;
        this.repository = repository;
    }

    public void index(MessageDoc doc) {
        try {
            operations.save(toDoc(doc));
        } catch (Exception e) {
            log.warn("es index failed, messageId={}", doc.getId(), e);
        }
    }

    public void delete(String messageId) {
        try {
            repository.deleteById(messageId);
        } catch (Exception e) {
            log.warn("es delete failed, messageId={}", messageId, e);
        }
    }

    /** 会话内全文检索（按 createdAt 倒序） */
    public List<MessageView> search(String conversationId, String keyword, int limit) {
        try {
            NativeQuery query = NativeQuery.builder()
                    .withQuery(q -> q.bool(b -> b
                            .must(m -> m.match(match -> match.field("content").query(keyword)))
                            .filter(f -> f.term(t -> t.field("conversationId").value(conversationId)))))
                    .withSort(Sort.by(Sort.Direction.DESC, "createdAt"))
                    .withMaxResults(limit)
                    .build();
            SearchHits<MessageSearchDoc> hits = operations.search(query, MessageSearchDoc.class);
            return hits.stream().map(SearchHit::getContent).map(MessageIndexer::toView).toList();
        } catch (Exception e) {
            log.warn("es search failed, conversationId={}, keyword={}", conversationId, keyword, e);
            return List.of();
        }
    }

    /**
     * 全局检索「与我相关」的消息：
     * 单聊（我是发送方或接收方）或群聊（我所在的群），按 createdAt 倒序。
     */
    public List<MessageView> searchGlobal(Long userId, List<Long> myGroupIds, String keyword, int limit) {
        try {
            NativeQuery query = NativeQuery.builder()
                    .withQuery(q -> q.bool(b -> b
                            .must(m -> m.match(match -> match.field("content").query(keyword)))
                            .should(s -> s.term(t -> t.field("senderId").value(userId)))
                            .should(s -> s.term(t -> t.field("receiverId").value(userId)))
                            .should(s -> s.terms(ts -> ts.field("groupId")
                                    .terms(t -> t.value(myGroupIds.stream().map(String::valueOf).toList()))))
                            .minimumShouldMatch("1")))
                    .withSort(Sort.by(Sort.Direction.DESC, "createdAt"))
                    .withMaxResults(limit)
                    .build();
            SearchHits<MessageSearchDoc> hits = operations.search(query, MessageSearchDoc.class);
            return hits.stream().map(SearchHit::getContent).map(MessageIndexer::toView).toList();
        } catch (Exception e) {
            log.warn("es global search failed, userId={}, keyword={}", userId, keyword, e);
            return List.of();
        }
    }

    private static MessageSearchDoc toDoc(MessageDoc doc) {
        MessageSearchDoc search = new MessageSearchDoc();
        search.setId(doc.getId());
        search.setConversationId(doc.getConversationId());
        search.setSenderId(doc.getSenderId());
        search.setReceiverId(doc.getReceiverId());
        search.setGroupId(doc.getGroupId());
        search.setType(doc.getType());
        search.setContent(doc.getContent());
        search.setCreatedAt(doc.getCreatedAt());
        return search;
    }

    private static MessageView toView(MessageSearchDoc doc) {
        return new MessageView(doc.getId(), doc.getConversationId(), doc.getSenderId(),
                doc.getReceiverId(), doc.getGroupId(), doc.getType(), doc.getContent(),
                null, null, null, null, false, doc.getCreatedAt(),
                false, null, null);
    }
}
