package kr.co.seoulit.his.clinical.emr.soap.mapper;

import kr.co.seoulit.his.clinical.emr.soap.SoapNote;
import kr.co.seoulit.his.clinical.emr.soap.dto.SoapResponse;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface SoapNoteMapper {
    SoapResponse toResponse(SoapNote entity);
}
