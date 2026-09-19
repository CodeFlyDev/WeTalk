package com.wetalk.user.repository;

import com.wetalk.user.entity.E2eeKey;
import org.springframework.data.jpa.repository.JpaRepository;

public interface E2eeKeyRepository extends JpaRepository<E2eeKey, Long> {
}
