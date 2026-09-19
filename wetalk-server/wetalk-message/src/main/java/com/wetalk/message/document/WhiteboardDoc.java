package com.wetalk.message.document;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 白板文档（MongoDB）：boardId = conversationId；笔画为归一化坐标的 JSON 字符串列表。
 * append-only 集合 + CLEAR 全量覆盖，天然 CRDT grow-only 语义（最终一致，无需 Yjs）。
 */
@Document("whiteboards")
public class WhiteboardDoc {

    @Id
    private String id;

    /** 笔画 JSON 列表（append-only；CLEAR 时清空） */
    private List<String> strokes = new ArrayList<>();

    private LocalDateTime updatedAt;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public List<String> getStrokes() {
        return strokes;
    }

    public void setStrokes(List<String> strokes) {
        this.strokes = strokes;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
