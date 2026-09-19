package com.wetalk.common;

/**
 * 业务错误码：段位划分 4xx00 客户端错误 / 5xx00 服务端错误 / 1xx00 业务规则
 */
public enum ErrorCode {
    OK(0),
    BAD_REQUEST(40000),
    UNAUTHORIZED(40100),
    FORBIDDEN(40300),
    NOT_FOUND(40400),
    USERNAME_TAKEN(10100),
    USER_NOT_FOUND(10200),
    NOT_FRIENDS(10300),
    FRIEND_REQUEST_INVALID(10400),
    NOT_GROUP_MEMBER(10500),
    WALLET_INSUFFICIENT(10600),
    RED_PACKET_EXHAUSTED(10601),
    RED_PACKET_GRABBED(10602),
    BIZ_ERROR(90000),
    SYSTEM_ERROR(50000);

    private final int code;

    ErrorCode(int code) {
        this.code = code;
    }

    public int getCode() {
        return code;
    }
}
