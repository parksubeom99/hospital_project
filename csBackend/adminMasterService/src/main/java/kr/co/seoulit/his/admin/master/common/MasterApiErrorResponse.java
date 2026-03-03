package kr.co.seoulit.his.admin.master.common;

import java.time.Instant;

public record MasterApiErrorResponse(
        String code,
        String message,
        Instant timestamp,
        String path
) {
    public static MasterApiErrorResponse of(String code, String message, String path) {
        return new MasterApiErrorResponse(code, message, Instant.now(), path);
    }
}
