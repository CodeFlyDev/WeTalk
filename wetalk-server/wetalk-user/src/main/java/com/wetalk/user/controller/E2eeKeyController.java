package com.wetalk.user.controller;

import com.wetalk.common.security.CurrentUser;
import com.wetalk.common.ApiResult;
import com.wetalk.user.entity.E2eeKey;
import com.wetalk.user.repository.E2eeKeyRepository;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;

/**
 * E2EE 公钥注册 / 查询：私钥永不上传，服务端只保管公钥供双方派生共享密钥
 */
@RestController
public class E2eeKeyController {

    private final E2eeKeyRepository repository;

    public E2eeKeyController(E2eeKeyRepository repository) {
        this.repository = repository;
    }

    public record PublicKeyRequest(
            @NotBlank(message = "公钥不能为空")
            @Size(max = 2048, message = "公钥格式非法")
            String publicKey) {
    }

    /** 注册 / 更新本人 E2EE 公钥（幂等覆盖） */
    @PutMapping("/api/users/e2ee-key")
    public ApiResult<Void> putKey(@jakarta.validation.Valid @RequestBody PublicKeyRequest request) {
        E2eeKey key = repository.findById(CurrentUser.id()).orElseGet(() -> {
            E2eeKey fresh = new E2eeKey();
            fresh.setUserId(CurrentUser.id());
            return fresh;
        });
        key.setPublicKeyJwk(request.publicKey());
        key.setUpdatedAt(LocalDateTime.now());
        repository.save(key);
        return ApiResult.ok(null);
    }

    /** 查询对方公钥（未注册返回 null，前端提示对方升级客户端） */
    @GetMapping("/api/users/{id}/e2ee-key")
    public ApiResult<String> getKey(@PathVariable Long id) {
        return ApiResult.ok(repository.findById(id).map(E2eeKey::getPublicKeyJwk).orElse(null));
    }
}
