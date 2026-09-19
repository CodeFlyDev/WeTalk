package com.wetalk.ai.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.wetalk.auth.security.CurrentUser;
import com.wetalk.common.ApiResult;
import com.wetalk.common.BizException;
import com.wetalk.common.ErrorCode;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;

/**
 * core 服务 HTTP 客户端（Phase 8 拆分后替代进程内 MessageService/UserService 直调）。
 * 权限模型：携带当前请求的 Bearer Token 透传给 core，参与者校验在 core 侧闭环；
 * ai-svc 只做编排，不落任何消息/用户数据。
 */
@Component
public class CoreClient {

    private final RestClient restClient;

    public CoreClient(AiCoreProperties properties) {
        this.restClient = RestClient.builder()
                .baseUrl(properties.getUrl())
                .build();
    }

    /* ---- core 响应载荷（只取所需字段，宽容反序列化） ---- */

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record CoreMessage(String id, String conversationId, Long senderId, String type,
                              String content, String refObjectKey, Boolean recalled) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record CoreUser(Long id, String username, String nickname) {
    }

    /** 按消息 ID 查单条（core 侧做会话参与者校验） */
    public CoreMessage getMessage(String messageId) {
        ApiResult<CoreMessage> resp = restClient.get()
                .uri("/api/messages/{id}", messageId)
                .header("Authorization", bearer())
                .retrieve()
                .body(new ParameterizedTypeReference<>() {
                });
        return data(resp);
    }

    /** 会话最近 N 条（core 侧做会话参与者校验，最多 50） */
    public List<CoreMessage> recent(String conversationId, int limit) {
        ApiResult<List<CoreMessage>> resp = restClient.get()
                .uri("/api/messages/recent?conversationId={cid}&limit={limit}", conversationId, limit)
                .header("Authorization", bearer())
                .retrieve()
                .body(new ParameterizedTypeReference<>() {
                });
        return data(resp);
    }

    /** 用户公开资料（摘要中的发送者昵称解析） */
    public CoreUser user(Long userId) {
        ApiResult<CoreUser> resp = restClient.get()
                .uri("/api/users/{id}", userId)
                .header("Authorization", bearer())
                .retrieve()
                .body(new ParameterizedTypeReference<>() {
                });
        return data(resp);
    }

    /* ---- 内部工具 ---- */

    /** 当前请求的 Authorization 头原样透传（ai-svc 本身无状态，不持有 token） */
    private static String bearer() {
        String token = CurrentUser.token();
        if (token == null || token.isBlank()) {
            throw new BizException(ErrorCode.UNAUTHORIZED, "未登录或凭证已失效");
        }
        return "Bearer " + token;
    }

    private static <T> T data(ApiResult<T> resp) {
        if (resp == null || resp.getCode() != ErrorCode.OK.getCode()) {
            String message = resp == null ? "core 服务无响应" : resp.getMessage();
            throw new BizException(of(resp == null ? ErrorCode.SYSTEM_ERROR.getCode() : resp.getCode()), message);
        }
        return resp.getData();
    }

    private static ErrorCode of(int code) {
        for (ErrorCode ec : ErrorCode.values()) {
            if (ec.getCode() == code) {
                return ec;
            }
        }
        return ErrorCode.SYSTEM_ERROR;
    }
}
