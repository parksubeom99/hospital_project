package kr.co.seoulit.his.admin.master.master.code.dto;

public record CodeSetResponse(
        Long codeSetId,
        String codeSetKey,
        String name,
        boolean active
) {
}
