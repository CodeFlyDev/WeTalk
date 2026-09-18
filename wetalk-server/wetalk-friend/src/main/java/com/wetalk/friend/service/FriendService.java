package com.wetalk.friend.service;

import com.wetalk.common.BizException;
import com.wetalk.common.ErrorCode;
import com.wetalk.friend.dto.FriendRequestView;
import com.wetalk.friend.entity.FriendRequest;
import com.wetalk.friend.entity.Friendship;
import com.wetalk.friend.repository.FriendRequestRepository;
import com.wetalk.friend.repository.FriendshipRepository;
import com.wetalk.message.port.FriendPort;
import com.wetalk.user.dto.UserView;
import com.wetalk.user.service.UserService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 好友领域服务：申请 / 同意 / 列表 / 删除 + FriendPort 实现（供 message 模块校验）
 */
@Service
public class FriendService implements FriendPort {

    private final FriendRequestRepository requestRepository;
    private final FriendshipRepository friendshipRepository;
    private final UserService userService;
    private final FriendNotifier notifier;

    public FriendService(FriendRequestRepository requestRepository,
                         FriendshipRepository friendshipRepository,
                         UserService userService,
                         FriendNotifier notifier) {
        this.requestRepository = requestRepository;
        this.friendshipRepository = friendshipRepository;
        this.userService = userService;
        this.notifier = notifier;
    }

    /** 发起好友申请（对方不存在则 404；已是好友则幂等拒绝） */
    @Transactional
    public FriendRequestView apply(Long fromUserId, Long toUserId, String remark) {
        if (fromUserId.equals(toUserId)) {
            throw new BizException(ErrorCode.BAD_REQUEST, "不能添加自己为好友");
        }
        userService.requireById(toUserId);
        if (friendshipRepository.existsByUserIdAndFriendId(fromUserId, toUserId)) {
            throw new BizException(ErrorCode.FRIEND_REQUEST_INVALID, "你们已经是好友");
        }
        FriendRequest request = requestRepository
                .findByFromUserIdAndToUserId(fromUserId, toUserId)
                .orElseGet(() -> {
                    FriendRequest fresh = new FriendRequest();
                    fresh.setFromUserId(fromUserId);
                    fresh.setToUserId(toUserId);
                    fresh.setRemark(remark);
                    return requestRepository.save(fresh);
                });
        if (!FriendRequest.STATUS_PENDING.equals(request.getStatus())) {
            request.reopen(remark);
            requestRepository.save(request);
        }
        notifier.notifyFriendRequest(request);
        return toView(request);
    }

    /** 同意申请：建立双向关系 */
    @Transactional
    public void accept(Long operatorId, Long requestId) {
        FriendRequest request = requestRepository.findById(requestId)
                .orElseThrow(() -> new BizException(ErrorCode.NOT_FOUND, "好友申请不存在"));
        if (!request.getToUserId().equals(operatorId)) {
            throw new BizException(ErrorCode.FORBIDDEN, "只能处理发给自己的申请");
        }
        if (!FriendRequest.STATUS_PENDING.equals(request.getStatus())) {
            throw new BizException(ErrorCode.FRIEND_REQUEST_INVALID, "该申请已处理");
        }
        friendshipRepository.save(pair(request.getFromUserId(), request.getToUserId()));
        friendshipRepository.save(pair(request.getToUserId(), request.getFromUserId()));
        request.markHandled(FriendRequest.STATUS_ACCEPTED);
        requestRepository.save(request);
        notifier.notifyFriendAccepted(request);
    }

    @Transactional(readOnly = true)
    public List<UserView> friends(Long userId) {
        return friendshipRepository.findByUserId(userId).stream()
                .map(Friendship::getFriendId)
                .map(userService::requireById)
                .map(userService::toView)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<FriendRequestView> pendingRequests(Long userId) {
        return requestRepository
                .findByToUserIdAndStatusOrderByCreatedAtDesc(userId, FriendRequest.STATUS_PENDING)
                .stream()
                .map(this::toView)
                .toList();
    }

    @Transactional
    public void remove(Long operatorId, Long friendId) {
        if (!areFriends(operatorId, friendId)) {
            throw new BizException(ErrorCode.NOT_FRIENDS, "你们还不是好友");
        }
        friendshipRepository.deletePair(operatorId, friendId);
    }

    private static Friendship pair(Long userId, Long friendId) {
        Friendship friendship = new Friendship();
        friendship.setUserId(userId);
        friendship.setFriendId(friendId);
        return friendship;
    }

    private FriendRequestView toView(FriendRequest request) {
        UserView fromUser = userService.toView(userService.requireById(request.getFromUserId()));
        return new FriendRequestView(request.getId(), fromUser, request.getRemark(),
                request.getStatus(), request.getCreatedAt());
    }

    // ---- FriendPort（供 wetalk-message 校验单聊关系） ----

    @Override
    @Transactional(readOnly = true)
    public boolean areFriends(long userIdA, long userIdB) {
        return friendshipRepository.existsByUserIdAndFriendId(userIdA, userIdB);
    }
}
