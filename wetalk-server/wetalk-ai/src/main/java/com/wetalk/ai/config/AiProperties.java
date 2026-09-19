package com.wetalk.ai.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * AI 服务配置：本地 faster-whisper（OpenAI 兼容接口）+ 本地 Ollama LLM，均可平滑切换云端
 */
@ConfigurationProperties(prefix = "wetalk.ai")
public class AiProperties {

    /** Whisper 服务地址（compose: http://whisper:8000；本机直跑: http://localhost:8001） */
    private String whisperUrl = "http://localhost:8001";

    /** 模型名，需与 whisper 容器 WHISPER__MODEL 一致 */
    private String whisperModel = "Systran/faster-whisper-small";

    /** Ollama 服务地址（compose: http://ollama:11434；本机直跑: http://localhost:11434） */
    private String ollamaUrl = "http://localhost:11434";

    /** Ollama 模型名，需先 ollama pull（compose 默认 OLLAMA_MODEL 同步注入） */
    private String ollamaModel = "qwen2.5:1.5b";

    /** Ollama 向量模型（RAG 知识库 embedding），需先 ollama pull nomic-embed-text */
    private String ollamaEmbedModel = "nomic-embed-text";

    public String getOllamaEmbedModel() {
        return ollamaEmbedModel;
    }

    public void setOllamaEmbedModel(String ollamaEmbedModel) {
        this.ollamaEmbedModel = ollamaEmbedModel;
    }

    public String getWhisperUrl() {
        return whisperUrl;
    }

    public void setWhisperUrl(String whisperUrl) {
        this.whisperUrl = whisperUrl;
    }

    public String getWhisperModel() {
        return whisperModel;
    }

    public void setWhisperModel(String whisperModel) {
        this.whisperModel = whisperModel;
    }

    public String getOllamaUrl() {
        return ollamaUrl;
    }

    public void setOllamaUrl(String ollamaUrl) {
        this.ollamaUrl = ollamaUrl;
    }

    public String getOllamaModel() {
        return ollamaModel;
    }

    public void setOllamaModel(String ollamaModel) {
        this.ollamaModel = ollamaModel;
    }
}
