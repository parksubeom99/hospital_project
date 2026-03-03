package kr.co.seoulit.his.support.lab.mapper;

import kr.co.seoulit.his.support.lab.LabResult;
import kr.co.seoulit.his.support.lab.dto.LabResultResponse;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface LabResultMapper {
    LabResultResponse toResponse(LabResult entity);
}
