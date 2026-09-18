package com.wetalk.group.repository;

import com.wetalk.group.entity.GroupMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface GroupMemberRepository extends JpaRepository<GroupMember, Long> {

    boolean existsByGroupIdAndUserId(Long groupId, Long userId);

    List<GroupMember> findByGroupId(Long groupId);

    List<GroupMember> findByUserId(Long userId);

    @Modifying
    @Query("delete from GroupMember m where m.groupId = :groupId and m.userId = :userId")
    void deleteMember(@Param("groupId") Long groupId, @Param("userId") Long userId);

    @Modifying
    @Query("delete from GroupMember m where m.groupId = :groupId")
    void deleteByGroupId(@Param("groupId") Long groupId);
}
