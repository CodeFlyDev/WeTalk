package com.wetalk.social.repository;

import com.wetalk.social.entity.PostComment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface PostCommentRepository extends JpaRepository<PostComment, Long> {

    List<PostComment> findByPostIdInOrderByCreatedAtAsc(Collection<Long> postIds);
}
