package com.wetalk.message.repository;

import com.wetalk.message.entity.Todo;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TodoRepository extends JpaRepository<Todo, Long> {

    /** 未完成在前，其余按创建时间倒序 */
    List<Todo> findByUserIdOrderByDoneAscCreatedAtDesc(Long userId);
}
