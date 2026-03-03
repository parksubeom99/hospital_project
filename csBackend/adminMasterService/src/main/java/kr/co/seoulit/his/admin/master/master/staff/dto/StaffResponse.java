package kr.co.seoulit.his.admin.master.master.staff.dto;

public record StaffResponse(
        Long staffProfileId,
        String loginId,
        String name,
        String jobType,
        Long departmentId,
        boolean active
) {}
