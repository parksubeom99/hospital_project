package kr.co.seoulit.his.admin.master.master.code.dto;

public record CodeItemResponse(
        Long codeItemId,
        String codeSetKey,
        String code,
        String name,
        boolean active,
        int sortOrder
) {}
