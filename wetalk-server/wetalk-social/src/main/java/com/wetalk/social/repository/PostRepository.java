package com.wetalk.social.repository;

import com.wetalk.social.entity.Post;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface PostRepository extends JpaRepository<Post, Long> {

    /** 好友圈 feed：好友 + 自己的动态，最新在前 */
    List<Post> findByUserIdInOrderByCreatedAtDesc(Collection<Long> userIds, Pageable pageable);
}
