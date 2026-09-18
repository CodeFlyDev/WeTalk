package com.wetalk.wallet.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** wallet 模块配置：启用红包过期退回定时任务 */
@Configuration
@EnableScheduling
public class WalletConfig {
}
