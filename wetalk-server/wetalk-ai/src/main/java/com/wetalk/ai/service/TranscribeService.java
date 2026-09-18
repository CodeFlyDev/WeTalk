package com.wetalk.ai.service;

import com.wetalk.ai.config.AiProperties;
import com.wetalk.common.BizException;
import com.wetalk.common.ErrorCode;
import com.wetalk.common.MessageType;
import com.wetalk.file.config.MinioProperties;
import com.wetalk.message.dto.MessageView;
import com.wetalk.message.service.MessageService;
import io.minio.GetObjectArgs;
import io.minio.MinioClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;

import java.io.InputStream;

/**
 * 语音转写：按消息 ID 校验会话参与者 → 从 MinIO 取音频 → 调用 faster-whisper（OpenAI 兼容 /v1/audio/transcriptions）。
 * 转写结果不落库（按需实时转），失败降级为业务异常提示。
 */
@Service
public class TranscribeService {

    private static final Logger log = LoggerFactory.getLogger(TranscribeService.class);

    /** 单次转写音频上限 10MB（60s webm/opus 远小于此） */
    private static final int MAX_AUDIO_BYTES = 10 * 1024 * 1024;

    private final MessageService messageService;
    private final MinioClient minioClient;
    private final MinioProperties minioProperties;
    private final AiProperties aiProperties;
    private final RestClient restClient;
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper =
            new com.fasterxml.jackson.databind.ObjectMapper();

    public TranscribeService(MessageService messageService,
                             MinioClient minioClient,
                             MinioProperties minioProperties,
                             AiProperties aiProperties) {
        this.messageService = messageService;
        this.minioClient = minioClient;
        this.minioProperties = minioProperties;
        this.aiProperties = aiProperties;
        this.restClient = RestClient.builder()
                .baseUrl(aiProperties.getWhisperUrl())
                .build();
    }

    public String transcribe(Long userId, String messageId) {
        // 消息级校验：仅会话参与者可转写
        MessageView view = messageService.get(userId, messageId);
        if (view.type() != MessageType.VOICE || view.refObjectKey() == null) {
            throw new BizException(ErrorCode.BAD_REQUEST, "仅语音消息支持转写");
        }

        byte[] audio = fetchAudio(view.refObjectKey());

        try {
            MultiValueMap<String, Object> form = new LinkedMultiValueMap<>();
            form.add("file", new ByteArrayResource(audio) {
                @Override
                public String getFilename() {
                    return "voice-" + messageId + ".webm";
                }
            });
            form.add("model", aiProperties.getWhisperModel());

            String resp = restClient.post()
                    .uri("/v1/audio/transcriptions")
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(form)
                    .retrieve()
                    .body(String.class);
            var node = objectMapper.readTree(resp == null ? "{}" : resp);
            return node.path("text").asText("");
        } catch (BizException e) {
            throw e;
        } catch (Exception e) {
            log.error("transcribe failed, messageId={}", messageId, e);
            throw new BizException(ErrorCode.SYSTEM_ERROR, "语音转写服务暂不可用");
        }
    }

    private byte[] fetchAudio(String objectKey) {
        try (InputStream is = minioClient.getObject(GetObjectArgs.builder()
                .bucket(minioProperties.getBucket())
                .object(objectKey)
                .build())) {
            byte[] audio = is.readAllBytes();
            if (audio.length > MAX_AUDIO_BYTES) {
                throw new BizException(ErrorCode.BAD_REQUEST, "音频文件过大，无法转写");
            }
            return audio;
        } catch (BizException e) {
            throw e;
        } catch (Exception e) {
            log.error("fetch audio failed, objectKey={}", objectKey, e);
            throw new BizException(ErrorCode.NOT_FOUND, "语音文件不存在或已过期");
        }
    }
}
