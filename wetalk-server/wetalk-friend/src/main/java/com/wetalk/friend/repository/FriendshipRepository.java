package com.wetalk.friend.repository;

import com.wetalk.friend.entity.Friendship;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface FriendshipRepository extends JpaRepository<Friendship, Long> {

    boolean existsByUserIdAndFriendId(Long userId, Long friendId);

    List<Friendship> findByUserId(Long userId);

    /** 成对删除双向好友关系 */
    @Modifying
    @Query("delete from Friendship f where (f.userId = :a and f.friendId = :b) or (f.userId = :b and f.friendId = :a)")
    void deletePair(@Param("a") Long userIdA, @Param("b") Long userIdB);
}
