package com.wetalk.gateway;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * WeTalk API 网关（Spring Cloud Gateway，独立进程）
 * 统一入口：/api/** → 业务服务（lb:// 服务名），/ws/** → IM 主链路 WebSocket。
 * 路由见 application.yml；Nacos 不可达时可整体用静态 uri 覆盖（偏离说明见 Task.md）。
 */
@SpringBootApplication
public class GatewayApplication {

    public static void main(String[] args) {
        SpringApplication.run(GatewayApplication.class, args);
    }
}
