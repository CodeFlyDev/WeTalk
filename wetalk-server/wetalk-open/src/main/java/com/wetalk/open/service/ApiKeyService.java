package com.wetalk.open.service;

import com.wetalk.common.BizException;
import com.wetalk.common.ErrorCode;
import com.wetalk.open.entity.ApiKey;
import com.wetalk.open.repository.ApiKeyRepository;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.List;

/**
 * API Key（个人访问令牌）管理：创建 / 列表 / 撤销。
 * 偏离原规划 OAuth2 授权码流程——个人 IM 机器人场景用 PAT 模式更轻（OAuth2 留 Phase 8）。
 */
@Service
public class ApiKeyService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final ApiKeyRepository apiKeyRepository;

    public ApiKeyService(ApiKeyRepository apiKeyRepository) {
        this.apiKeyRepository = apiKeyRepository;
    }

    /** 创建 key，明文仅本次返回 */
    public ApiKey create(Long userId, String name) {
        ApiKey key = new ApiKey();
        key.setUserId(userId);
        key.setName(name == null || name.isBlank() ? "default" : name.trim());
        key.setApiKey("wt_" + HexFormat.of().formatHex(randomBytes()));
        key.setCreatedAt(LocalDateTime.now());
        return apiKeyRepository.save(key);
    }

    public List<ApiKey> list(Long userId) {
        return apiKeyRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    public void revoke(Long userId, Long id) {
        ApiKey key = apiKeyRepository.findById(id)
                .orElseThrow(() -> new BizException(ErrorCode.NOT_FOUND, "Key 不存在"));
        if (!key.getUserId().equals(userId)) {
            throw new BizException(ErrorCode.FORBIDDEN, "无权操作该 Key");
        }
        key.setRevoked(true);
        apiKeyRepository.save(key);
    }

    /** X-Api-Key 认证：返回 key 归属用户 ID */
    public Long authenticate(String apiKey) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new BizException(ErrorCode.UNAUTHORIZED, "缺少 X-Api-Key");
        }
        return apiKeyRepository.findByApiKeyAndRevokedFalse(apiKey.trim())
                .orElseThrow(() -> new BizException(ErrorCode.UNAUTHORIZED, "API Key 无效或已撤销"))
                .getUserId();
    }

    private static byte[] randomBytes() {
        byte[] bytes = new byte[16];
        RANDOM.nextBytes(bytes);
        return bytes;
    }
}
