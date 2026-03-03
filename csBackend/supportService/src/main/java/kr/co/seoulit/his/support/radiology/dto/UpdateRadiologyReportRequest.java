package kr.co.seoulit.his.support.radiology.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdateRadiologyReportRequest(
        @NotBlank(message = "reportText is required")
        String reportText,
        String reason
) {}
