package com.wetalk;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

/**
 * WeTalk 模块化单体启动入口
 * 业务能力按 package 分层在 wetalk-* 模块内，Phase 3+ 按需拆分为独立微服务。
 */
@SpringBootApplication
@ConfigurationPropertiesScan("com.wetalk")
public class WetalkApplication {

    public static void main(String[] args) {
        SpringApplication.run(WetalkApplication.class, args);
    }
}
