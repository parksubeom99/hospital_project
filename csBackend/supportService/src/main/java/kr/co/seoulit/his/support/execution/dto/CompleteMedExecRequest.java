package kr.co.seoulit.his.support.execution.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter @Setter
public class CompleteMedExecRequest {
    @NotBlank
    private String note;
}
