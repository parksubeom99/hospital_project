package kr.co.seoulit.his.admin.master.master.schedule.dto;

import java.time.LocalTime;

public record ScheduleTemplateResponse(
        Long scheduleTemplateId,
        Long staffProfileId,
        Integer dayOfWeek,
        LocalTime startTime,
        LocalTime endTime,
        Integer slotMinutes,
        boolean active,
        String note
) {
}
