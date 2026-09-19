package com.wetalk.common;

/**
 * 业务异常：携带 ErrorCode，由全局异常处理器统一转换为 ApiResult。
 */
public class BizException extends RuntimeException {

    private final ErrorCode errorCode;

    public BizException(ErrorCode errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }

    public BizException(ErrorCode errorCode) {
        this(errorCode, errorCode.name());
    }

    public ErrorCode getErrorCode() {
        return errorCode;
    }
}
