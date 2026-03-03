package kr.co.seoulit.his.clinical.order.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record UpdateOrderItemsRequest(
        @Valid @NotNull List<CreateOrderItemRequest> items
) {}
