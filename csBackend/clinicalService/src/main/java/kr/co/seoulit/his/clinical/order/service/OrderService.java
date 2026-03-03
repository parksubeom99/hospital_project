package kr.co.seoulit.his.clinical.order.service;

import kr.co.seoulit.his.clinical.audit.AuditClient;
import kr.co.seoulit.his.clinical.client.SupportWorklistClient;
import kr.co.seoulit.his.clinical.common.CurrentUserUtil;
import kr.co.seoulit.his.clinical.exception.BusinessException;
import kr.co.seoulit.his.clinical.exception.ErrorCode;
import kr.co.seoulit.his.clinical.order.OrderHeader;
import kr.co.seoulit.his.clinical.order.OrderItem;
import kr.co.seoulit.his.clinical.order.OrderItemRepository;
import kr.co.seoulit.his.clinical.order.OrderRepository;
import kr.co.seoulit.his.clinical.order.dto.CreateOrderRequest;
import kr.co.seoulit.his.clinical.order.dto.OrderDeleteRequest;
import kr.co.seoulit.his.clinical.order.dto.OrderItemResponse;
import kr.co.seoulit.his.clinical.order.dto.OrderResponse;
import kr.co.seoulit.his.clinical.order.dto.UpdateOrderItemsRequest;
import kr.co.seoulit.his.clinical.order.mapper.OrderMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orders;
    private final OrderItemRepository items;
    private final OrderMapper mapper;
    private final AuditClient audit;
    private final SupportWorklistClient supportWorklist;

    private OrderHeader getActiveOrderOrThrow(Long orderId) {
        return orders.findByOrderIdAndDeletedFalse(orderId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Order not found. orderId=" + orderId));
    }

    @Transactional
    public OrderResponse create(CreateOrderRequest req) {
        // ✅ 멱등: 동일 idempotencyKey로 이미 생성됐으면 기존 오더 반환 (deleted=false만)
        return orders.findByIdempotencyKeyAndDeletedFalse(req.idempotencyKey())
                .map(mapper::toResponse)
                .orElseGet(() -> {
                    String primaryCode = (req.items() != null && !req.items().isEmpty()) ? req.items().get(0).itemCode() : null;
                    String primaryName = (req.items() != null && !req.items().isEmpty()) ? req.items().get(0).itemName() : null;

                    OrderHeader o = OrderHeader.builder()
                            .visitId(req.visitId())
                            .category(req.category())
                            .primaryItemCode(primaryCode)
                            .primaryItemName(primaryName)
                            .status("NEW")
                            .idempotencyKey(req.idempotencyKey())
                            .createdAt(LocalDateTime.now())
                            .build();
                    OrderHeader saved = orders.save(o);

                    if (req.items() != null) {
                        for (var it : req.items()) {
                            items.save(OrderItem.builder()
                                    .orderId(saved.getOrderId())
                                    .itemCode(it.itemCode())
                                    .itemName(it.itemName())
                                    .quantity(it.qty())
                                    .build());
                        }
                    }

                    // ✅ 비CRUD(감사로그) - 컨트롤러 밖으로 이동
                    audit.write("ORDER_CREATED", "ORDER", String.valueOf(saved.getOrderId()), null,
                            Map.of("status", saved.getStatus(), "visitId", saved.getVisitId(), "category", saved.getCategory()));

                    // v6: Order 생성 시 Support Worklist를 자동 생성(REST 기반, 실패 시 degrade)
                    supportWorklist.createWorklistTask(saved.getOrderId(), saved.getVisitId(), saved.getCategory(), saved.getStatus(), saved.getPrimaryItemCode(), saved.getPrimaryItemName());

                    return mapper.toResponse(saved);
                });
    }

    @Transactional(readOnly = true)
    public OrderResponse get(Long orderId) {
        return mapper.toResponse(getActiveOrderOrThrow(orderId));
    }

    @Transactional(readOnly = true)
    public List<OrderResponse> list(String status, String category) {
        List<OrderHeader> list;
        if (status != null && category != null) list = orders.findByStatusAndCategoryAndDeletedFalse(status, category);
        else if (status != null) list = orders.findByStatusAndDeletedFalse(status);
        else list = orders.findAllByDeletedFalse();
        return mapper.toResponseList(list);
    }

    @Transactional
    public OrderResponse updateItems(Long orderId, UpdateOrderItemsRequest req) {
        OrderHeader o = getActiveOrderOrThrow(orderId);

        if (!"NEW".equalsIgnoreCase(o.getStatus())) {
            throw new BusinessException(ErrorCode.INVALID_STATE, "Only NEW order can be updated. status=" + o.getStatus());
        }

        items.deleteByOrderId(orderId);
        for (var it : req.items()) {
            items.save(OrderItem.builder()
                    .orderId(orderId)
                    .itemCode(it.itemCode())
                    .itemName(it.itemName())
                    .quantity(it.qty())
                    .build());
        }

        o.setUpdatedAt(LocalDateTime.now());
        orders.save(o);

        audit.write("ORDER_UPDATED", "ORDER", String.valueOf(o.getOrderId()), null,
                Map.of("status", o.getStatus()));

        return mapper.toResponse(o);
    }

    @Transactional
    public OrderResponse cancel(Long orderId) {
        OrderHeader o = getActiveOrderOrThrow(orderId);

        // ✅ 정책: NEW 상태에서만 취소 가능
        if (!"NEW".equalsIgnoreCase(o.getStatus())) {
            throw new BusinessException(ErrorCode.INVALID_STATE, "Only NEW order can be canceled. status=" + o.getStatus());
        }

        o.setStatus("CANCELED");
        o.setUpdatedAt(LocalDateTime.now());
        OrderHeader saved = orders.save(o);

        audit.write("ORDER_CANCELED", "ORDER", String.valueOf(saved.getOrderId()), null,
                Map.of("status", saved.getStatus()));

        return mapper.toResponse(saved);
    }

    @Transactional
    public OrderResponse markInProgress(Long orderId) {
        OrderHeader o = getActiveOrderOrThrow(orderId);

        if ("DONE".equalsIgnoreCase(o.getStatus())) {
            throw new BusinessException(ErrorCode.INVALID_STATE, "DONE order cannot be marked IN_PROGRESS.");
        }
        if ("CANCELED".equalsIgnoreCase(o.getStatus())) {
            throw new BusinessException(ErrorCode.INVALID_STATE, "CANCELED order cannot be marked IN_PROGRESS.");
        }

        o.setStatus("IN_PROGRESS");
        o.setUpdatedAt(LocalDateTime.now());
        OrderHeader saved = orders.save(o);

        audit.write("ORDER_IN_PROGRESS", "ORDER", String.valueOf(saved.getOrderId()), null,
                Map.of("status", saved.getStatus()));

        return mapper.toResponse(saved);
    }

    /**
     * 결과 입력 완료(Resulted)
     * - 회장님 도식 기준: Support에서 결과를 입력하는 순간 "업무 완료"(DONE)로 전이
     * - NEW / IN_PROGRESS 에서만 허용
     */
    @Transactional
    public OrderResponse markResulted(Long orderId) {
        OrderHeader o = getActiveOrderOrThrow(orderId);

        if ("CANCELED".equalsIgnoreCase(o.getStatus())) {
            throw new BusinessException(ErrorCode.INVALID_STATE, "CANCELED order cannot be marked RESULTED.");
        }
        if (!("NEW".equalsIgnoreCase(o.getStatus()) || "IN_PROGRESS".equalsIgnoreCase(o.getStatus()))) {
            throw new BusinessException(ErrorCode.INVALID_STATE, "Only NEW/IN_PROGRESS order can be marked RESULTED. status=" + o.getStatus());
        }

        // ✅ 정책 고정: 결과 입력 = DONE
        o.setStatus("DONE");
        o.setUpdatedAt(LocalDateTime.now());
        OrderHeader saved = orders.save(o);

        audit.write("ORDER_RESULTED", "ORDER", String.valueOf(saved.getOrderId()), null,
                Map.of("status", saved.getStatus()));

        return mapper.toResponse(saved);
    }

    /**
     * 의사 확인(Reviewed)
     * - 결과 입력 완료(DONE) 이후에 의사 확인(REVIEWED)로 전환
     * - 과거 호환: RESULTED 상태도 허용
     */
    @Transactional
    public OrderResponse markReviewed(Long orderId) {
        OrderHeader o = getActiveOrderOrThrow(orderId);

        if ("CANCELED".equalsIgnoreCase(o.getStatus())) {
            throw new BusinessException(ErrorCode.INVALID_STATE, "CANCELED order cannot be marked REVIEWED.");
        }
        if (!("DONE".equalsIgnoreCase(o.getStatus()) || "RESULTED".equalsIgnoreCase(o.getStatus()))) {
            throw new BusinessException(ErrorCode.INVALID_STATE, "Only DONE/RESULTED order can be marked REVIEWED. status=" + o.getStatus());
        }

        o.setStatus("REVIEWED");
        o.setUpdatedAt(LocalDateTime.now());
        OrderHeader saved = orders.save(o);

        audit.write("ORDER_REVIEWED", "ORDER", String.valueOf(saved.getOrderId()), null,
                Map.of("status", saved.getStatus()));

        return mapper.toResponse(saved);
    }

    @Transactional
    public OrderResponse markDone(Long orderId) {
        OrderHeader o = getActiveOrderOrThrow(orderId);

        if ("CANCELED".equalsIgnoreCase(o.getStatus())) {
            throw new BusinessException(ErrorCode.INVALID_STATE, "CANCELED order cannot be marked DONE.");
        }

        o.setStatus("DONE");
        o.setUpdatedAt(LocalDateTime.now());
        OrderHeader saved = orders.save(o);

        audit.write("ORDER_DONE", "ORDER", String.valueOf(saved.getOrderId()), null,
                Map.of("status", saved.getStatus()));

        return mapper.toResponse(saved);
    }

    /**
     * [ADDED] Soft Delete API
     * 정책:
     * - NEW / CANCELED 상태에서만 삭제 가능
     * - IN_PROGRESS / DONE 은 삭제 불가 (정정/취소 정책으로 유도)
     */
    @Transactional
    public OrderResponse delete(Long orderId, OrderDeleteRequest req) {
        OrderHeader o = getActiveOrderOrThrow(orderId);

        if (!"NEW".equalsIgnoreCase(o.getStatus()) && !"CANCELED".equalsIgnoreCase(o.getStatus())) {
            throw new BusinessException(ErrorCode.INVALID_STATE, "Only NEW/CANCELED order can be deleted. status=" + o.getStatus());
        }

        o.setDeleted(true);
        o.setDeletedAt(LocalDateTime.now());
        o.setDeletedBy(CurrentUserUtil.currentLoginIdOrNull());
        o.setDeletedReason(req == null ? null : req.reason());
        o.setUpdatedAt(LocalDateTime.now());

        OrderHeader saved = orders.save(o);

        audit.write("ORDER_DELETED", "ORDER", String.valueOf(saved.getOrderId()), null,
                Map.of("status", saved.getStatus(), "deleted", true));

        return mapper.toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<OrderItemResponse> listItems(Long orderId) {
        // NOTE: 삭제된 오더의 아이템은 조회하지 않도록 getActiveOrder로 보장
        getActiveOrderOrThrow(orderId);
        return mapper.toItemResponseList(items.findByOrderId(orderId));
    }
}
