package com.wetalk.social.service;

import com.wetalk.common.BizException;
import com.wetalk.common.ErrorCode;
import com.wetalk.friend.service.FriendService;
import com.wetalk.social.dto.PostView;
import com.wetalk.social.entity.Post;
import com.wetalk.social.entity.PostComment;
import com.wetalk.social.entity.PostLike;
import com.wetalk.social.repository.PostCommentRepository;
import com.wetalk.social.repository.PostLikeRepository;
import com.wetalk.social.repository.PostRepository;
import com.wetalk.user.entity.UserAccount;
import com.wetalk.user.service.UserService;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 朋友圈/动态：发布（文字 + 最多 9 图）、好友圈 feed（好友 + 自己）、点赞（幂等）、评论。
 * 可见性：仅作者本人与其好友（canSee = author == viewer || areFriends）。
 */
@Service
public class PostService {

    private static final int MAX_IMAGES = 9;
    private static final int FEED_SIZE = 20;
    private static final int COMMENTS_LIMIT = 50;

    private final PostRepository postRepository;
    private final PostLikeRepository likeRepository;
    private final PostCommentRepository commentRepository;
    private final FriendService friendService;
    private final UserService userService;
    private final org.springframework.context.ApplicationEventPublisher eventPublisher;

    public PostService(PostRepository postRepository,
                       PostLikeRepository likeRepository,
                       PostCommentRepository commentRepository,
                       FriendService friendService,
                       UserService userService,
                       org.springframework.context.ApplicationEventPublisher eventPublisher) {
        this.postRepository = postRepository;
        this.likeRepository = likeRepository;
        this.commentRepository = commentRepository;
        this.friendService = friendService;
        this.userService = userService;
        this.eventPublisher = eventPublisher;
    }

    @Transactional
    public PostView publish(Long userId, String content, List<String> imageKeys) {
        String text = content == null ? "" : content.strip();
        List<String> keys = imageKeys == null ? List.of() : imageKeys.stream().filter(k -> k != null && !k.isBlank()).toList();
        if (text.isEmpty() && keys.isEmpty()) {
            throw new BizException(ErrorCode.BAD_REQUEST, "内容和图片至少填一项");
        }
        if (keys.size() > MAX_IMAGES) {
            throw new BizException(ErrorCode.BAD_REQUEST, "图片最多 " + MAX_IMAGES + " 张");
        }
        Post post = new Post();
        post.setUserId(userId);
        post.setContent(text.length() > 2000 ? text.substring(0, 2000) : text);
        post.setImageKeys(String.join(",", keys));
        post = postRepository.save(post);
        eventPublisher.publishEvent(new com.wetalk.common.AchieveEvent(userId, "FIRST_POST"));
        return toView(post, userId);
    }

    @Transactional
    public void delete(Long userId, Long postId) {
        Post post = requirePost(postId);
        if (!post.getUserId().equals(userId)) {
            throw new BizException(ErrorCode.FORBIDDEN, "只能删除自己的动态");
        }
        postRepository.delete(post);
    }

    /** 好友圈 feed：好友 + 自己的动态，最新在前 */
    @Transactional(readOnly = true)
    public List<PostView> feed(Long userId) {
        List<Long> circle = new ArrayList<>(friendService.friendIds(userId));
        circle.add(userId);
        Pageable page = PageRequest.of(0, FEED_SIZE);
        return postRepository.findByUserIdInOrderByCreatedAtDesc(circle, page).stream()
                .map(p -> toView(p, userId))
                .toList();
    }

    @Transactional
    public void like(Long userId, Long postId) {
        Post post = requirePost(postId);
        requireCanSee(userId, post);
        if (likeRepository.existsByPostIdAndUserId(postId, userId)) {
            return;
        }
        PostLike like = new PostLike();
        like.setPostId(postId);
        like.setUserId(userId);
        likeRepository.save(like);
    }

    @Transactional
    public void unlike(Long userId, Long postId) {
        requirePost(postId);
        likeRepository.deleteByPostIdAndUserId(postId, userId);
    }

    /** 单条动态详情（进入评论区刷新用） */
    @Transactional(readOnly = true)
    public PostView detail(Long userId, Long postId) {
        Post post = requirePost(postId);
        requireCanSee(userId, post);
        return toView(post, userId);
    }

    @Transactional
    public PostView comment(Long userId, Long postId, String content) {
        Post post = requirePost(postId);
        requireCanSee(userId, post);
        String text = content == null ? "" : content.strip();
        if (text.isEmpty()) {
            throw new BizException(ErrorCode.BAD_REQUEST, "评论内容不能为空");
        }
        PostComment c = new PostComment();
        c.setPostId(postId);
        c.setUserId(userId);
        c.setContent(text.length() > 500 ? text.substring(0, 500) : text);
        commentRepository.save(c);
        return toView(post, userId);
    }

    /* ---------- 内部 ---------- */

    private Post requirePost(Long postId) {
        return postRepository.findById(postId)
                .orElseThrow(() -> new BizException(ErrorCode.NOT_FOUND, "动态不存在或已删除"));
    }

    private void requireCanSee(Long viewer, Post post) {
        if (!post.getUserId().equals(viewer) && !friendService.friendIds(post.getUserId()).contains(viewer)) {
            throw new BizException(ErrorCode.FORBIDDEN, "仅好友可见");
        }
    }

    private PostView toView(Post post, Long viewer) {
        long likeCount = likeRepository.countByPostId(post.getId());
        boolean likedByMe = likeRepository.existsByPostIdAndUserId(post.getId(), viewer);
        List<PostComment> comments = commentRepository.findByPostIdInOrderByCreatedAtAsc(List.of(post.getId()));

        // 作者与评论者名称批量解析
        Set<Long> userIds = new HashSet<>();
        userIds.add(post.getUserId());
        comments.forEach(c -> userIds.add(c.getUserId()));
        Map<Long, UserAccount> users = userIds.stream()
                .collect(Collectors.toMap(Function.identity(), userService::requireById, (a, b) -> a));

        List<PostView.CommentView> commentViews = comments.stream()
                .limit(COMMENTS_LIMIT)
                .map(c -> new PostView.CommentView(c.getId(), c.getUserId(),
                        nameOf(users.get(c.getUserId())), c.getContent(), c.getCreatedAt()))
                .toList();

        UserAccount author = users.get(post.getUserId());
        List<String> imageKeys = post.getImageKeys() == null || post.getImageKeys().isEmpty()
                ? List.of() : List.of(post.getImageKeys().split(","));
        return new PostView(post.getId(), post.getUserId(), nameOf(author), author.getAvatarUrl(),
                post.getContent(), imageKeys, post.getCreatedAt(), likeCount, likedByMe, commentViews);
    }

    private static String nameOf(UserAccount user) {
        if (user == null) {
            return "未知用户";
        }
        return user.getNickname() == null || user.getNickname().isBlank() ? user.getUsername() : user.getNickname();
    }
}
