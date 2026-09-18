package com.wetalk.common;

/**
 * 统一响应包装：{ code, message, data }
 * code = 0 表示成功，非 0 为业务错误码（见 ErrorCode）。
 */
public class ApiResult<T> {

    private int code;
    private String message;
    private T data;

    public ApiResult() {
    }

    public ApiResult(int code, String message, T data) {
        this.code = code;
        this.message = message;
        this.data = data;
    }

    public static <T> ApiResult<T> ok(T data) {
        return new ApiResult<>(ErrorCode.OK.getCode(), "ok", data);
    }

    public static <T> ApiResult<T> error(ErrorCode errorCode, String message) {
        return new ApiResult<>(errorCode.getCode(), message, null);
    }

    public static <T> ApiResult<T> error(int code, String message) {
        return new ApiResult<>(code, message, null);
    }

    public int getCode() {
        return code;
    }

    public void setCode(int code) {
        this.code = code;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public T getData() {
        return data;
    }

    public void setData(T data) {
        this.data = data;
    }
}
