package com.wetalk.friend.repository;

import com.wetalk.friend.entity.FriendRequest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FriendRequestRepository extends JpaRepository<FriendRequest, Long> {

    Optional<FriendRequest> findByFromUserIdAndToUserId(Long fromUserId, Long toUserId);

    List<FriendRequest> findByToUserIdAndStatusOrderByCreatedAtDesc(Long toUserId, String status);
}
