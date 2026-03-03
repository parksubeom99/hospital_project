package kr.co.seoulit.his.admin.master.patientalert.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record PatientAlertUpsertRequest(
        Long patientAlertId,
        @NotNull Long patientId,
        @NotBlank String type,
        @NotBlank String message,
        Boolean active
) {}
