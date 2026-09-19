package com.wetalk.voip.controller;

import com.wetalk.auth.security.CurrentUser;
import com.wetalk.common.ApiResult;
import com.wetalk.common.BizException;
import com.wetalk.common.ErrorCode;
import com.wetalk.user.service.UserService;
import com.wetalk.voip.entity.VoiceRoom;
import com.wetalk.voip.repository.VoiceRoomRepository;
import com.wetalk.voip.service.VoiceRoomService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 语音房间 REST（房间元数据；实时信令走 WS /app/voip.room）
 */
@RestController
@RequestMapping("/api/voip/rooms")
public class VoiceRoomController {

    public record CreateRequest(@NotBlank(message = "房间名不能为空") @Size(max = 20) String name) {
    }

    public record RoomView(Long id, String name, Long ownerId, String ownerName,
                           int onlineCount, boolean mine) {
    }

    private final VoiceRoomRepository roomRepository;
    private final VoiceRoomService voiceRoomService;
    private final UserService userService;

    public VoiceRoomController(VoiceRoomRepository roomRepository,
                               VoiceRoomService voiceRoomService,
                               UserService userService) {
        this.roomRepository = roomRepository;
        this.voiceRoomService = voiceRoomService;
        this.userService = userService;
    }

    /** 创建房间（创建者即房主） */
    @PostMapping
    public ApiResult<RoomView> create(@Valid @RequestBody CreateRequest request) {
        VoiceRoom room = new VoiceRoom();
        room.setName(request.name().trim());
        room.setOwnerId(CurrentUser.id());
        room = roomRepository.save(room);
        return ApiResult.ok(toView(room));
    }

    /** 房间列表（按创建时间倒序 + 在线人数） */
    @GetMapping
    public ApiResult<List<RoomView>> list() {
        List<RoomView> views = roomRepository.findAll().stream()
                .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                .map(this::toView)
                .toList();
        return ApiResult.ok(views);
    }

    /** 解散房间（仅房主） */
    @DeleteMapping("/{id}")
    public ApiResult<Void> delete(@PathVariable Long id) {
        VoiceRoom room = roomRepository.findById(id)
                .orElseThrow(() -> new BizException(ErrorCode.NOT_FOUND, "房间不存在"));
        if (!room.getOwnerId().equals(CurrentUser.id())) {
            throw new BizException(ErrorCode.FORBIDDEN, "仅房主可解散房间");
        }
        roomRepository.delete(room);
        return ApiResult.ok(null);
    }

    private RoomView toView(VoiceRoom room) {
        return new RoomView(
                room.getId(),
                room.getName(),
                room.getOwnerId(),
                userService.toView(userService.requireById(room.getOwnerId())).nickname(),
                voiceRoomService.onlineCount(room.getId()),
                room.getOwnerId().equals(CurrentUser.id()));
    }
}
