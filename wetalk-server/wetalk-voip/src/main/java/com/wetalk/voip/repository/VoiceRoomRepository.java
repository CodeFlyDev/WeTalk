package com.wetalk.voip.repository;

import com.wetalk.voip.entity.VoiceRoom;
import org.springframework.data.jpa.repository.JpaRepository;

public interface VoiceRoomRepository extends JpaRepository<VoiceRoom, Long> {
}
