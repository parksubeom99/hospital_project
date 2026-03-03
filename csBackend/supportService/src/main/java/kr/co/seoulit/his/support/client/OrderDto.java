package kr.co.seoulit.his.support.client;

public record OrderDto(
        Long orderId,
        Long visitId,
        String category,
        String status,
        String primaryItemCode,
        String primaryItemName
) {
}
