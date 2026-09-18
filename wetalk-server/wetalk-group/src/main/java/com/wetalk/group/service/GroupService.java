package com.wetalk.group.service;

import com.wetalk.common.BizException;
import com.wetalk.common.ErrorCode;
import com.wetalk.group.dto.CreateGroupRequest;
import com.wetalk.group.dto.GroupView;
import com.wetalk.group.entity.Group;
import com.wetalk.group.entity.GroupMember;
import com.wetalk.group.repository.GroupMemberRepository;
import com.wetalk.group.repository.GroupRepository;
import com.wetalk.message.port.GroupPort;
import com.wetalk.user.dto.UserView;
import com.wetalk.user.service.UserService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashSet;
import java.util.List;

/**
 * 群组领域服务：创建 / 详情 / 成员增删退 + GroupPort 实现（供 message 模块校验）
 */
@Service
public class GroupService implements GroupPort {

    private final GroupRepository groupRepository;
    private final GroupMemberRepository memberRepository;
    private final UserService userService;

    public GroupService(GroupRepository groupRepository,
                        GroupMemberRepository memberRepository,
                        UserService userService) {
        this.groupRepository = groupRepository;
        this.memberRepository = memberRepository;
        this.userService = userService;
    }

    /** 创建群：owner 自动入群，可带初始成员（去重、忽略不存在的用户） */
    @Transactional
    public GroupView create(Long ownerId, CreateGroupRequest request) {
        Group group = new Group();
        group.setName(request.name());
        group.setOwnerId(ownerId);
        group.setAvatarUrl(request.avatarUrl());
        group = groupRepository.save(group);

        memberRepository.save(member(group.getId(), ownerId, GroupMember.ROLE_OWNER));
        if (request.memberIds() != null) {
            LinkedHashSet<Long> memberIds = new LinkedHashSet<>(request.memberIds());
            memberIds.remove(ownerId);
            for (Long memberUserId : memberIds) {
                if (userService.existsById(memberUserId)) {
                    memberRepository.save(member(group.getId(), memberUserId, GroupMember.ROLE_MEMBER));
                }
            }
        }
        return toView(group);
    }

    @Transactional(readOnly = true)
    public GroupView detail(Long groupId, Long operatorId) {
        Group group = requireById(groupId);
        if (!isMember(groupId, operatorId)) {
            throw new BizException(ErrorCode.NOT_GROUP_MEMBER, "不是群成员，无法查看");
        }
        return toView(group);
    }

    @Transactional(readOnly = true)
    public List<GroupView> myGroups(Long userId) {
        return memberRepository.findByUserId(userId).stream()
                .map(GroupMember::getGroupId)
                .map(this::requireById)
                .map(this::toView)
                .toList();
    }

    @Transactional
    public void addMembers(Long operatorId, Long groupId, List<Long> userIds) {
        requireById(groupId);
        requireAdmin(operatorId, groupId);
        LinkedHashSet<Long> ids = new LinkedHashSet<>(userIds);
        for (Long userId : ids) {
            if (userService.existsById(userId) && !memberRepository.existsByGroupIdAndUserId(groupId, userId)) {
                memberRepository.save(member(groupId, userId, GroupMember.ROLE_MEMBER));
            }
        }
    }

    @Transactional
    public void removeMember(Long operatorId, Long groupId, Long userId) {
        requireAdmin(operatorId, groupId);
        if (userId.equals(requireById(groupId).getOwnerId())) {
            throw new BizException(ErrorCode.FORBIDDEN, "不能移除群主");
        }
        memberRepository.deleteMember(groupId, userId);
    }

    @Transactional
    public void quit(Long operatorId, Long groupId) {
        Group group = requireById(groupId);
        if (group.getOwnerId().equals(operatorId)) {
            throw new BizException(ErrorCode.FORBIDDEN, "群主不能退群，请先转让或解散");
        }
        memberRepository.deleteMember(groupId, operatorId);
    }

    @Transactional
    public void dismiss(Long operatorId, Long groupId) {
        Group group = requireById(groupId);
        if (!group.getOwnerId().equals(operatorId)) {
            throw new BizException(ErrorCode.FORBIDDEN, "仅群主可解散群");
        }
        memberRepository.deleteByGroupId(groupId);
        groupRepository.delete(group);
    }

    // ---- GroupPort（供 wetalk-message 校验群消息） ----

    @Override
    @Transactional(readOnly = true)
    public boolean isMember(long groupId, long userId) {
        return memberRepository.existsByGroupIdAndUserId(groupId, userId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Long> memberIds(long groupId) {
        return memberRepository.findByGroupId(groupId).stream()
                .map(GroupMember::getUserId)
                .toList();
    }

    private GroupMember member(Long groupId, Long userId, String role) {
        GroupMember groupMember = new GroupMember();
        groupMember.setGroupId(groupId);
        groupMember.setUserId(userId);
        groupMember.setRole(role);
        return groupMember;
    }

    private void requireAdmin(Long operatorId, Long groupId) {
        if (!isMember(groupId, operatorId)) {
            throw new BizException(ErrorCode.NOT_GROUP_MEMBER, "不是群成员");
        }
        Group group = requireById(groupId);
        if (!group.getOwnerId().equals(operatorId)) {
            String role = memberRepository.findByGroupId(groupId).stream()
                    .filter(m -> m.getUserId().equals(operatorId))
                    .findFirst()
                    .map(GroupMember::getRole)
                    .orElse(GroupMember.ROLE_MEMBER);
            if (!GroupMember.ROLE_OWNER.equals(role) && !GroupMember.ROLE_ADMIN.equals(role)) {
                throw new BizException(ErrorCode.FORBIDDEN, "仅群主/管理员可操作");
            }
        }
    }

    private Group requireById(Long groupId) {
        return groupRepository.findById(groupId)
                .orElseThrow(() -> new BizException(ErrorCode.NOT_FOUND, "群不存在: " + groupId));
    }

    private GroupView toView(Group group) {
        List<GroupView.MemberView> members = memberRepository.findByGroupId(group.getId()).stream()
                .map(m -> {
                    UserView user = userService.toView(userService.requireById(m.getUserId()));
                    return new GroupView.MemberView(user.id(), user.username(), user.nickname(), m.getRole());
                })
                .toList();
        return new GroupView(group.getId(), group.getName(), group.getOwnerId(),
                group.getAvatarUrl(), group.getAnnouncement(), group.getCreatedAt(), members);
    }
}
