package com.wetalk.ai.client;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * core 服务地址（微服务拆分后 ai-svc 的上游依赖）。
 * compose: http://wetalk-core:8080；本机直跑: http://localhost:8080
 */
@ConfigurationProperties(prefix = "wetalk.core")
public class AiCoreProperties {

    private String url = "http://localhost:8080";

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }
}
