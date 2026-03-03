package kr.co.seoulit.his.admin.frontoffice.billing.dto.invoice;

public record InvoiceItemResponse(
        Long invoiceItemId,
        String itemCode,
        String itemName,
        Long unitPrice,
        Integer qty,
        Long lineTotal
) {}
