package kr.co.seoulit.his.clinical.common;

import java.time.LocalDateTime;

public record ApiErrorResponse(
        String code,
        String message,
        String path,
        LocalDateTime timestamp
) { }
