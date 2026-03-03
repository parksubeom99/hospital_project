package kr.co.seoulit.his.support.lab.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdateLabResultRequest(
        @NotBlank(message = "resultText is required")
        String resultText,
        String reason
) {}
