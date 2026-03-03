package kr.co.seoulit.his.clinical.finalorder.service;

import kr.co.seoulit.his.clinical.audit.AuditClient;
import kr.co.seoulit.his.clinical.outbox.OutboxService;
import kr.co.seoulit.his.clinical.client.SupportExecutionClient;
import kr.co.seoulit.his.clinical.client.AdminExecutionClient;
import kr.co.seoulit.his.clinical.exception.BusinessException;
import kr.co.seoulit.his.clinical.exception.ErrorCode;
import kr.co.seoulit.his.clinical.finalorder.FinalOrder;
import kr.co.seoulit.his.clinical.finalorder.FinalOrderRepository;
import kr.co.seoulit.his.clinical.finalorder.dto.CreateFinalOrderRequest;
import kr.co.seoulit.his.clinical.finalorder.dto.FinalOrderResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class FinalOrderService {

    private final FinalOrderRepository repo;
    private final AuditClient audit;
    private final SupportExecutionClient supportExec;
    private final AdminExecutionClient adminExec; // [ADDED][STEP6]
    private final OutboxService outbox; // [ADDED][STEP8]

    @Value("${kafka.topic.clinical-finalorder:clinical.finalorder.v1}")
    private String topicFinalOrder; // [FIX] used when recording outbox events


    @Transactional
    public FinalOrderResponse create(CreateFinalOrderRequest req) {
        // idempotency: same key -> return existing
        FinalOrder existed = repo.findByIdempotencyKey(req.getIdempotencyKey()).orElse(null);
        if (existed != null) {
            return toResponse(existed);
        }

        LocalDateTime now = LocalDateTime.now();
        FinalOrder saved = repo.save(FinalOrder.builder()
                .visitId(req.getVisitId())
                .type(req.getType())
                .status("ORDERED")
                .note(req.getNote())
                .idempotencyKey(req.getIdempotencyKey())
                .createdAt(now)
                .updatedAt(now)
                .build());

        audit.write("FINAL_ORDER_CREATED", "FINAL_ORDER", String.valueOf(saved.getFinalOrderId()), null,
                Map.of("visitId", saved.getVisitId(), "type", saved.getType(), "status", saved.getStatus()));
        outbox.record("FINAL_ORDER_CREATED", "FINAL_ORDER", String.valueOf(saved.getFinalOrderId()),
                String.valueOf(saved.getFinalOrderId()), topicFinalOrder,
                Map.of("finalOrderId", saved.getFinalOrderId(), "visitId", saved.getVisitId(), "type", saved.getType(), "status", saved.getStatus()));
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<FinalOrderResponse> list(String status, String type) {
        // 단순 MVP: where 조건이 없으면 전체, 있으면 in-memory filter (데이터 작으면 OK)
        // 필요 시 QueryMethod로 최적화 가능
        return repo.findAll().stream()
                .filter(o -> status == null || status.isBlank() || status.equalsIgnoreCase(o.getStatus()))
                .filter(o -> type == null || type.isBlank() || type.equalsIgnoreCase(o.getType()))
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public FinalOrderResponse updateStatus(Long id, String status) {
        FinalOrder o = repo.findById(id).orElseThrow(() -> new IllegalArgumentException("FinalOrder not found: " + id));
        String before = o.getStatus();
        o.setStatus(status);
        o.setUpdatedAt(LocalDateTime.now());

        audit.write("FINAL_ORDER_STATUS_CHANGED", "FINAL_ORDER", String.valueOf(o.getFinalOrderId()), null,
                Map.of("before", before, "after", o.getStatus(), "visitId", o.getVisitId(), "type", o.getType()));
        outbox.record("FINAL_ORDER_STATUS_CHANGED", "FINAL_ORDER", String.valueOf(o.getFinalOrderId()),
                String.valueOf(o.getFinalOrderId()), topicFinalOrder,
                Map.of("finalOrderId", o.getFinalOrderId(), "visitId", o.getVisitId(), "type", o.getType(), "before", before, "after", o.getStatus()));
return toResponse(o);
    }

    
    // =========================
    // [ADDED][STEP4] Finalize API
    // =========================
    /**
     * Plan→Execute 확정(Finalize)
     * - 정책: ORDERED 상태에서만 FINALIZED로 전이
     * - 멱등: 이미 FINALIZED면 그대로 반환
     */
    @Transactional
            public FinalOrderResponse finalizeOrder(Long id) {
        FinalOrder o = repo.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "FinalOrder not found: " + id));

        String before = (o.getStatus() == null ? "" : o.getStatus().toUpperCase());

        if ("FINALIZED".equals(before)) {
            return toResponse(o);
        }
        if (!"ORDERED".equals(before)) {
            throw new BusinessException(ErrorCode.INVALID_STATE,
                    "Only ORDERED finalOrder can be finalized. status=" + o.getStatus());
        }

        o.setStatus("FINALIZED");
        o.setUpdatedAt(LocalDateTime.now());

        // [STEP9] Finalize 이벤트 Outbox 기록(=Kafka로 전달될 원천)
        outbox.record("FINAL_ORDER_FINALIZED", "FINAL_ORDER", String.valueOf(id),
                String.valueOf(id), topicFinalOrder,
                Map.of("finalOrderId", id, "visitId", o.getVisitId(), "type", o.getType(), "status", o.getStatus()));

        audit.write("FINAL_ORDER_FINALIZED", "FINAL_ORDER", String.valueOf(id), null,
                Map.of("finalOrderId", id, "visitId", o.getVisitId(), "type", o.getType()));

        return toResponse(o);
    }

    @Transactional(readOnly = true)
    public FinalOrderResponse get(Long id) {
        FinalOrder o = repo.findById(id).orElseThrow(() -> new IllegalArgumentException("FinalOrder not found: " + id));
        return toResponse(o);
    }

    private FinalOrderResponse toResponse(FinalOrder o) {
        return FinalOrderResponse.builder()
                .finalOrderId(o.getFinalOrderId())
                .visitId(o.getVisitId())
                .type(o.getType())
                .status(o.getStatus())
                .note(o.getNote())
                .idempotencyKey(o.getIdempotencyKey())
                .createdAt(o.getCreatedAt())
                .updatedAt(o.getUpdatedAt())
                .build();
    }
}
