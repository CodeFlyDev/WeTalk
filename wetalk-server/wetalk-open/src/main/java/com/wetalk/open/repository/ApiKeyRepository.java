package com.wetalk.open.repository;

import com.wetalk.open.entity.ApiKey;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ApiKeyRepository extends JpaRepository<ApiKey, Long> {

    List<ApiKey> findByUserIdOrderByCreatedAtDesc(Long userId);

    Optional<ApiKey> findByApiKeyAndRevokedFalse(String apiKey);

    /** 供 Webhook 推送前校验调用方仍持有有效 key（预留） */
    long countByUserIdAndRevokedFalse(Long userId);
}
