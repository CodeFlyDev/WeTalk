package com.wetalk.message.service;

import com.wetalk.common.BizException;
import com.wetalk.common.ErrorCode;
import com.wetalk.message.dto.TodoCreateRequest;
import com.wetalk.message.entity.Todo;
import com.wetalk.message.repository.TodoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 个人待办：增 / 勾选（幂等取反）/ 删 / 列表（仅本人）
 */
@Service
public class TodoService {

    private final TodoRepository todoRepository;

    public TodoService(TodoRepository todoRepository) {
        this.todoRepository = todoRepository;
    }

    @Transactional(readOnly = true)
    public List<Todo> list(Long userId) {
        return todoRepository.findByUserIdOrderByDoneAscCreatedAtDesc(userId);
    }

    @Transactional
    public Todo create(Long userId, TodoCreateRequest request) {
        Todo todo = new Todo();
        todo.setUserId(userId);
        todo.setContent(request.content().trim());
        todo.setDueAt(request.dueAt());
        return todoRepository.save(todo);
    }

    /** 勾选 / 取消勾选（取反） */
    @Transactional
    public Todo toggle(Long userId, Long id) {
        Todo todo = requireMine(userId, id);
        todo.setDone(!todo.isDone());
        return todo;
    }

    @Transactional
    public void delete(Long userId, Long id) {
        todoRepository.delete(requireMine(userId, id));
    }

    private Todo requireMine(Long userId, Long id) {
        Todo todo = todoRepository.findById(id)
                .orElseThrow(() -> new BizException(ErrorCode.NOT_FOUND, "待办不存在"));
        if (!todo.getUserId().equals(userId)) {
            throw new BizException(ErrorCode.FORBIDDEN, "无权操作他人待办");
        }
        return todo;
    }
}
