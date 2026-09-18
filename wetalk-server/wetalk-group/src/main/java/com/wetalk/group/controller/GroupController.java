package com.wetalk.group.controller;

import com.wetalk.auth.security.CurrentUser;
import com.wetalk.common.ApiResult;
import com.wetalk.group.dto.CreateGroupRequest;
import com.wetalk.group.dto.GroupView;
import com.wetalk.group.service.GroupService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 群组接口：创建 / 我的群 / 详情 / 加人 / 踢人 / 退群 / 解散
 */
@RestController
@RequestMapping("/api/groups")
public class GroupController {

    private final GroupService groupService;

    public GroupController(GroupService groupService) {
        this.groupService = groupService;
    }

    @PostMapping
    public ApiResult<GroupView> create(@Valid @RequestBody CreateGroupRequest request) {
        return ApiResult.ok(groupService.create(CurrentUser.id(), request));
    }

    @GetMapping("/my")
    public ApiResult<List<GroupView>> my() {
        return ApiResult.ok(groupService.myGroups(CurrentUser.id()));
    }

    @GetMapping("/{id}")
    public ApiResult<GroupView> detail(@PathVariable Long id) {
        return ApiResult.ok(groupService.detail(id, CurrentUser.id()));
    }

    @PostMapping("/{id}/members")
    public ApiResult<Void> addMembers(@PathVariable Long id, @RequestParam List<Long> userIds) {
        groupService.addMembers(CurrentUser.id(), id, userIds);
        return ApiResult.ok(null);
    }

    @DeleteMapping("/{id}/members/{userId}")
    public ApiResult<Void> removeMember(@PathVariable Long id, @PathVariable Long userId) {
        groupService.removeMember(CurrentUser.id(), id, userId);
        return ApiResult.ok(null);
    }

    @PostMapping("/{id}/quit")
    public ApiResult<Void> quit(@PathVariable Long id) {
        groupService.quit(CurrentUser.id(), id);
        return ApiResult.ok(null);
    }

    @DeleteMapping("/{id}")
    public ApiResult<Void> dismiss(@PathVariable Long id) {
        groupService.dismiss(CurrentUser.id(), id);
        return ApiResult.ok(null);
    }
}
