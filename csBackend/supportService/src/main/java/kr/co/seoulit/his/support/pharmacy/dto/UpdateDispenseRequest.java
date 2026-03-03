package kr.co.seoulit.his.support.pharmacy.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdateDispenseRequest(
        @NotBlank(message = "note is required")
        String note,
        String reason
) {}
