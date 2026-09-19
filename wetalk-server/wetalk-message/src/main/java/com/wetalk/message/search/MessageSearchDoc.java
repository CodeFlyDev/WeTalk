package com.wetalk.message.search;

import com.wetalk.common.MessageType;
import org.springframework.data.annotation.Id;
import org.springframework.data.elasticsearch.annotations.DateFormat;
import org.springframework.data.elasticsearch.annotations.Document;
import org.springframework.data.elasticsearch.annotations.Field;
import org.springframework.data.elasticsearch.annotations.FieldType;

import java.time.LocalDateTime;

/**
 * 消息检索文档（wetalk-messages 索引）。
 * 分词说明：standard analyzer 对中文按单字切分，可满足子串/词组模糊检索；IK 分词后续按需安装。
 * recalled 消息在撤回时即从索引删除，因此命中结果必然可见。
 */
@Document(indexName = "wetalk-messages", createIndex = true)
public class MessageSearchDoc {

    @Id
    private String id;

    @Field(type = FieldType.Keyword)
    private String conversationId;

    @Field(type = FieldType.Long)
    private Long senderId;

    @Field(type = FieldType.Long)
    private Long receiverId;

    @Field(type = FieldType.Long)
    private Long groupId;

    @Field(type = FieldType.Keyword)
    private MessageType type;

    @Field(type = FieldType.Text)
    private String content;

    @Field(type = FieldType.Date, format = DateFormat.date_hour_minute_second_millis)
    private LocalDateTime createdAt;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getConversationId() {
        return conversationId;
    }

    public void setConversationId(String conversationId) {
        this.conversationId = conversationId;
    }

    public Long getSenderId() {
        return senderId;
    }

    public void setSenderId(Long senderId) {
        this.senderId = senderId;
    }

    public Long getReceiverId() {
        return receiverId;
    }

    public void setReceiverId(Long receiverId) {
        this.receiverId = receiverId;
    }

    public Long getGroupId() {
        return groupId;
    }

    public void setGroupId(Long groupId) {
        this.groupId = groupId;
    }

    public MessageType getType() {
        return type;
    }

    public void setType(MessageType type) {
        this.type = type;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
