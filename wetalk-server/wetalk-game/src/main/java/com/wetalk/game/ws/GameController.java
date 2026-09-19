package com.wetalk.game.ws;

import com.wetalk.game.dto.GameRequest;
import com.wetalk.game.service.GameService;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Controller;

import java.security.Principal;

/** 五子棋对局入口（STOMP）：Principal name = userId */
@Controller
public class GameController {

    private final GameService gameService;

    public GameController(GameService gameService) {
        this.gameService = gameService;
    }

    @MessageMapping("/game")
    public void handle(@Payload GameRequest request, Principal principal) {
        gameService.handle(Long.parseLong(principal.getName()), request);
    }
}
