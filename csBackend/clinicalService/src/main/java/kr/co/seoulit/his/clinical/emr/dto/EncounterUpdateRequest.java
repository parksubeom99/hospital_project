package kr.co.seoulit.his.clinical.emr.dto;

import jakarta.validation.constraints.NotBlank;

public record EncounterUpdateRequest(
        @NotBlank String note
) {}
