package com.wetalk.message.repository;

import com.wetalk.message.entity.ScheduledMessage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface ScheduledMessageRepository extends JpaRepository<ScheduledMessage, Long> {

    List<ScheduledMessage> findBySenderIdAndStatusOrderBySendAtAsc(Long senderId, String status);

    List<ScheduledMessage> findByStatusAndSendAtLessThanEqual(String status, LocalDateTime time);
}
