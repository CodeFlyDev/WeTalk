package com.wetalk.message.service;

import com.wetalk.common.BizException;
import com.wetalk.common.ErrorCode;
import com.wetalk.message.dto.FavoriteView;
import com.wetalk.message.dto.MessageView;
import com.wetalk.message.entity.Favorite;
import com.wetalk.message.repository.FavoriteRepository;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 消息收藏：按用户维度存消息副本（t_favorite），幂等收藏 / 取消 / 列表。
 * 权限复用 MessageService.get 的参与者校验——仅能收藏自己可见的消息。
 */
@Service
public class FavoriteService {

    private final FavoriteRepository favoriteRepository;
    private final MessageService messageService;

    public FavoriteService(FavoriteRepository favoriteRepository, MessageService messageService) {
        this.favoriteRepository = favoriteRepository;
        this.messageService = messageService;
    }

    /** 收藏消息（幂等：已收藏直接返回既有记录） */
    public FavoriteView add(Long userId, String messageId) {
        MessageView view = messageService.get(userId, messageId);
        if (view.recalled()) {
            throw new BizException(ErrorCode.BIZ_ERROR, "已撤回的消息不能收藏");
        }
        Favorite favorite = favoriteRepository.findByUserIdAndMessageId(userId, messageId)
                .orElseGet(() -> {
                    Favorite f = new Favorite();
                    f.setUserId(userId);
                    f.setMessageId(view.id());
                    f.setConversationId(view.conversationId());
                    f.setSenderId(view.senderId());
                    f.setType(view.type());
                    f.setContent(view.content());
                    f.setRefObjectKey(view.refObjectKey());
                    return favoriteRepository.save(f);
                });
        return toView(favorite);
    }

    /** 取消收藏（幂等：不存在视为成功） */
    public void remove(Long userId, String messageId) {
        favoriteRepository.findByUserIdAndMessageId(userId, messageId)
                .ifPresent(favoriteRepository::delete);
    }

    /** 我的收藏（最新在前） */
    public List<FavoriteView> list(Long userId) {
        return favoriteRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(FavoriteService::toView)
                .toList();
    }

    private static FavoriteView toView(Favorite f) {
        return new FavoriteView(f.getId(), f.getMessageId(), f.getConversationId(),
                f.getSenderId(), f.getType(), f.getContent(), f.getRefObjectKey(), f.getCreatedAt());
    }
}
