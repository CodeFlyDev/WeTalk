package com.wetalk.ai.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * AI 服务配置：本地 faster-whisper（OpenAI 兼容接口），可平滑切换云端 ASR
 */
@ConfigurationProperties(prefix = "wetalk.ai")
public class AiProperties {

    /** Whisper 服务地址（compose: http://whisper:8000；本机直跑: http://localhost:8001） */
    private String whisperUrl = "http://localhost:8001";

    /** 模型名，需与 whisper 容器 WHISPER__MODEL 一致 */
    private String whisperModel = "Systran/faster-whisper-small";

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
}
