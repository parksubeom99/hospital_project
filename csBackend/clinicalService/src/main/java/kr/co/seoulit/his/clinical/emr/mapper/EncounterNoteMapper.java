package kr.co.seoulit.his.clinical.emr.mapper;

import kr.co.seoulit.his.clinical.emr.EncounterNote;
import kr.co.seoulit.his.clinical.emr.dto.EncounterResponse;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;

@Mapper(componentModel = "spring")
public interface EncounterNoteMapper {
    @Mapping(source = "noteId", target = "encounterNoteId")
    EncounterResponse toResponse(EncounterNote entity);

    List<EncounterResponse> toResponseList(List<EncounterNote> entities);
}
