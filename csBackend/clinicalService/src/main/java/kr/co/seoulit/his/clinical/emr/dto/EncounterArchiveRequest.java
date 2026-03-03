package kr.co.seoulit.his.clinical.emr.dto;

import jakarta.validation.constraints.Size;

public record EncounterArchiveRequest(
        @Size(max = 255) String reason
) {}
