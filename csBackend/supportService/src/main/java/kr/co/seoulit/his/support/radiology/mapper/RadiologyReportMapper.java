package kr.co.seoulit.his.support.radiology.mapper;

import kr.co.seoulit.his.support.radiology.RadiologyReport;
import kr.co.seoulit.his.support.radiology.dto.RadiologyReportResponse;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface RadiologyReportMapper {
    @Mapping(source = "radiologyReportId", target = "reportId")
    RadiologyReportResponse toResponse(RadiologyReport entity);
}
