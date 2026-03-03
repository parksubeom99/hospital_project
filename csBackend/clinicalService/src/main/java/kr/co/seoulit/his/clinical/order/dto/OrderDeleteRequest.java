package kr.co.seoulit.his.clinical.order.dto;

import jakarta.validation.constraints.Size;

public record OrderDeleteRequest(
        @Size(max = 255) String reason
) {}
