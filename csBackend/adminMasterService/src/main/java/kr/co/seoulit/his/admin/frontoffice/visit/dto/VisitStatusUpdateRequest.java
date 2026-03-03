package kr.co.seoulit.his.admin.frontoffice.visit.dto;

import jakarta.validation.constraints.NotBlank;

public record VisitStatusUpdateRequest(
        @NotBlank String status
) {}
