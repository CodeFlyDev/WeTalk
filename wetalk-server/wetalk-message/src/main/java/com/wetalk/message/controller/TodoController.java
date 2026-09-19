package com.wetalk.message.controller;

import com.wetalk.auth.security.CurrentUser;
import com.wetalk.common.ApiResult;
import com.wetalk.message.dto.TodoCreateRequest;
import com.wetalk.message.entity.Todo;
import com.wetalk.message.service.TodoService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 个人待办 REST（t_todo 由 JPA ddl-auto 自动建表）
 */
@RestController
@RequestMapping("/api/todos")
public class TodoController {

    private final TodoService todoService;

    public TodoController(TodoService todoService) {
        this.todoService = todoService;
    }

    @GetMapping
    public ApiResult<List<Todo>> list() {
        return ApiResult.ok(todoService.list(CurrentUser.id()));
    }

    @PostMapping
    public ApiResult<Todo> create(@Valid @RequestBody TodoCreateRequest request) {
        return ApiResult.ok(todoService.create(CurrentUser.id(), request));
    }

    @PutMapping("/{id}/toggle")
    public ApiResult<Todo> toggle(@PathVariable Long id) {
        return ApiResult.ok(todoService.toggle(CurrentUser.id(), id));
    }

    @DeleteMapping("/{id}")
    public ApiResult<Void> delete(@PathVariable Long id) {
        todoService.delete(CurrentUser.id(), id);
        return ApiResult.ok(null);
    }
}
