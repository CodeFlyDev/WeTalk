package com.wetalk.ai.search;

import org.springframework.data.annotation.Id;
import org.springframework.data.elasticsearch.annotations.DateFormat;
import org.springframework.data.elasticsearch.annotations.Document;
import org.springframework.data.elasticsearch.annotations.Field;
import org.springframework.data.elasticsearch.annotations.FieldType;

import java.time.LocalDateTime;

/**
 * RAG 知识块（wetalk-knowledge 索引）。
 * 偏离 Task.md 原规划 Milvus —— 复用既有 ES 8 的 dense_vector + script_score 余弦相似度，
 * 零新增基础设施（无需 milvus/etcd 容器）；个人知识库规模（万级块）下性能足够。
 */
@Document(indexName = "wetalk-knowledge", createIndex = true)
public class KnowledgeChunkDoc {

    @Id
    private String id;

    @Field(type = FieldType.Keyword)
    private Long userId;

    /** 同一次粘贴的知识文档 ID（块分组，便于整篇删除） */
    @Field(type = FieldType.Keyword)
    private String docId;

    @Field(type = FieldType.Keyword)
    private String title;

    @Field(type = FieldType.Text)
    private String chunkText;

    private int chunkIndex;

    /** nomic-embed-text 输出 768 维 */
    @Field(type = FieldType.Dense_Vector, dims = 768)
    private float[] vector;

    @Field(type = FieldType.Date, format = DateFormat.date_hour_minute_second_millis)
    private LocalDateTime createdAt;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public String getDocId() {
        return docId;
    }

    public void setDocId(String docId) {
        this.docId = docId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getChunkText() {
        return chunkText;
    }

    public void setChunkText(String chunkText) {
        this.chunkText = chunkText;
    }

    public int getChunkIndex() {
        return chunkIndex;
    }

    public void setChunkIndex(int chunkIndex) {
        this.chunkIndex = chunkIndex;
    }

    public float[] getVector() {
        return vector;
    }

    public void setVector(float[] vector) {
        this.vector = vector;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
