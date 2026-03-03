package kr.co.seoulit.his.admin.master.master.staff.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record StaffUpdateRequest(
        @NotBlank @Size(max = 100) String name,
        @NotBlank @Size(max = 50) String jobType,
        Long departmentId,
        Boolean active
) {
}
