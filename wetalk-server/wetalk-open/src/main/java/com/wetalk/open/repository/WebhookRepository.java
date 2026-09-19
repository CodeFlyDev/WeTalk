package com.wetalk.open.repository;

import com.wetalk.open.entity.Webhook;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface WebhookRepository extends JpaRepository<Webhook, Long> {

    List<Webhook> findByUserIdOrderByCreatedAtDesc(Long userId);

    List<Webhook> findByUserIdAndActiveTrue(Long userId);
}
