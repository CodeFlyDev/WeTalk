package com.wetalk.file.controller;

import com.wetalk.common.ApiResult;
import com.wetalk.file.dto.PresignRequest;
import com.wetalk.file.dto.PresignResult;
import com.wetalk.file.service.FileService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 文件接口：presigned 上传 / 下载地址
 * 客户端流程：POST /presign 拿 uploadUrl → HTTP PUT 直传 MinIO → 消息里只带 objectKey
 */
@RestController
@RequestMapping("/api/files")
public class FileController {

    private final FileService fileService;

    public FileController(FileService fileService) {
        this.fileService = fileService;
    }

    @PostMapping("/presign")
    public ApiResult<PresignResult> presign(@Valid @RequestBody PresignRequest request) {
        return ApiResult.ok(fileService.presignUpload(request.fileName(), request.contentType()));
    }

    @GetMapping("/download-url")
    public ApiResult<String> downloadUrl(@RequestParam String objectKey) {
        return ApiResult.ok(fileService.presignDownload(objectKey));
    }
}
