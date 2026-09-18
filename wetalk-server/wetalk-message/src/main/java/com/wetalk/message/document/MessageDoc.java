package com.wetalk.message.document;

import com.wetalk.common.MessageType;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 消息历史（MongoDB，时间序列；ES 全文检索由后续同步任务承接）
 */
@Document("messages")
@CompoundIndex(name = "idx_conv_created", def = "{'conversationId': 1, 'createdAt': -1}")
public class MessageDoc {

    @Id
    private String id;

    /** 单聊 dm:{minId}:{maxId}；群聊 g:{groupId} */
    private String conversationId;

    private Long senderId;

    /** 单聊接收者（群聊为空） */
    private Long receiverId;

    /** 群聊 ID（单聊为空） */
    private Long groupId;

    private MessageType type;

    /** 文本内容 / 媒体说明 */
    private String content;

    /** 媒体对象存储 Key（文件/图片/语音/视频走 MinIO presigned 直传，WS 只传引用） */
    private String refObjectKey;

    /** 客户端幂等 ID */
    private String clientMsgId;

    /** 引用回复的原消息 ID（同会话内） */
    private String replyToId;

    /** 群聊 @ 提及的用户 ID 列表 */
    private List<Long> mentionedUserIds;

    /** 是否已撤回（软标记，历史补拉保留占位） */
    private boolean recalled;

    private LocalDateTime recalledAt;

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

    public String getRefObjectKey() {
        return refObjectKey;
    }

    public void setRefObjectKey(String refObjectKey) {
        this.refObjectKey = refObjectKey;
    }

    public String getClientMsgId() {
        return clientMsgId;
    }

    public void setClientMsgId(String clientMsgId) {
        this.clientMsgId = clientMsgId;
    }

    public String getReplyToId() {
        return replyToId;
    }

    public void setReplyToId(String replyToId) {
        this.replyToId = replyToId;
    }

    public List<Long> getMentionedUserIds() {
        return mentionedUserIds;
    }

    public void setMentionedUserIds(List<Long> mentionedUserIds) {
        this.mentionedUserIds = mentionedUserIds;
    }

    public boolean isRecalled() {
        return recalled;
    }

    public void setRecalled(boolean recalled) {
        this.recalled = recalled;
    }

    public LocalDateTime getRecalledAt() {
        return recalledAt;
    }

    public void setRecalledAt(LocalDateTime recalledAt) {
        this.recalledAt = recalledAt;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
