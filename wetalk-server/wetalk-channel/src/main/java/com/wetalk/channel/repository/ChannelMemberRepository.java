package com.wetalk.channel.repository;

import com.wetalk.channel.entity.ChannelMember;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ChannelMemberRepository extends JpaRepository<ChannelMember, Long> {

    boolean existsByChannelIdAndUserId(Long channelId, Long userId);

    List<ChannelMember> findByChannelId(Long channelId);

    List<ChannelMember> findByUserId(Long userId);

    long countByChannelId(Long channelId);

    void deleteByChannelId(Long channelId);

    void deleteByChannelIdAndUserId(Long channelId, Long userId);
}
