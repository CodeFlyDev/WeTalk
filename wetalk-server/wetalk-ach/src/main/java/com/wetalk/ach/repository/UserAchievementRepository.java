package com.wetalk.ach.repository;

import com.wetalk.ach.entity.UserAchievement;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface UserAchievementRepository extends JpaRepository<UserAchievement, Long> {

    boolean existsByUserIdAndCode(Long userId, String code);

    List<UserAchievement> findByUserId(Long userId);
}
