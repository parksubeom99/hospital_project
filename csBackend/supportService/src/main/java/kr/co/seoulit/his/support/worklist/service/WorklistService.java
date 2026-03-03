package kr.co.seoulit.his.support.worklist.service;

import kr.co.seoulit.his.support.audit.AuditClient;
import kr.co.seoulit.his.support.client.OrderClient;
import kr.co.seoulit.his.support.client.OrderDto;
import kr.co.seoulit.his.support.outbox.QueueEventOutboxService;
import kr.co.seoulit.his.support.worklist.WorklistTask;
import kr.co.seoulit.his.support.worklist.WorklistTaskRepository;
import kr.co.seoulit.his.support.worklist.dto.WorkItemDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class WorklistService {

    private final OrderClient orderClient;
    private final QueueEventOutboxService outbox;
    private final WorklistTaskRepository tasks;
    private final AuditClient audit;

    /**
     * Worklist는 조회 전용 서비스입니다.
     * - 외부(Order) DTO를 그대로 노출하지 않고, Worklist 전용 DTO(WorkItemDto)로 변환해서 반환합니다.
     * - status 미지정 시 NEW로 조회합니다.
     */
    public List<WorkItemDto> getWorklist(String category, String status, String primaryItemCode) {
        String effectiveStatus = (status == null || status.isBlank()) ? "NEW" : status;

        // v6: Worklist를 "Order 생성 시 자동 생성" 규칙으로 고정하기 위해,
        //     Support가 자체적으로 worklist_task를 보유합니다.
        try {
            List<WorklistTask> persisted = (primaryItemCode == null || primaryItemCode.isBlank())
                    ? tasks.findByCategoryAndStatusOrderByCreatedAtDesc(category, effectiveStatus)
                    : tasks.findByCategoryAndStatusAndPrimaryItemCodeOrderByCreatedAtDesc(category, effectiveStatus, primaryItemCode);

            if (!persisted.isEmpty()) {
                return persisted.stream()
                        .map(t -> new WorkItemDto(
                                t.getOrderId(),
                                t.getVisitId(),
                                t.getCategory(),
                                t.getStatus(),
                                t.getPrimaryItemCode(),
                                t.getPrimaryItemName()
                        ))
                        .collect(Collectors.toList());
            }
        } catch (Exception ignored) {
            // DB 패치/테이블 미적용 상태에서도 Worklist가 깨지지 않게 fallback
        }

        // ✅ 호환/복구: 초기 데이터가 없거나 마이그레이션 전에는 Clinical에서 조회해 채웁니다.
        List<OrderDto> orders = orderClient.fetchOrders(effectiveStatus, category);
        // lazy upsert (degrade)
        for (var o : orders) {
            try {
                tasks.findByOrderId(o.orderId()).ifPresentOrElse(existing -> {
                    // 상태는 Clinical이 소스 오브 트루스인 구간이 있으니 동기화만 수행
                    existing.setStatus(o.status());
                    existing.setPrimaryItemCode(o.primaryItemCode());
                    existing.setPrimaryItemName(o.primaryItemName());
                    existing.setUpdatedAt(java.time.LocalDateTime.now());
                    tasks.save(existing);
                }, () -> tasks.save(WorklistTask.builder()
                        .orderId(o.orderId())
                        .visitId(o.visitId())
                        .category(o.category())
                        .primaryItemCode(o.primaryItemCode())
                        .primaryItemName(o.primaryItemName())
                        .status(o.status())
                        .createdAt(java.time.LocalDateTime.now())
                        .build()));
            } catch (Exception ignored) {
            }
        }

        return orders.stream()
                .map(o -> new WorkItemDto(o.orderId(), o.visitId(), o.category(), o.status(), o.primaryItemCode(), o.primaryItemName()))
                .collect(Collectors.toList());
    }

    /**
     * 담당자 착수(진행중 전환)
     */
    public void startWork(Long orderId, String category) {
        orderClient.markInProgress(orderId);

        // v6: Support의 worklist_task 상태도 함께 전이 (없으면 skip)
        try {
            tasks.findByOrderId(orderId).ifPresent(t -> {
                t.setStatus("IN_PROGRESS");
                t.setUpdatedAt(java.time.LocalDateTime.now());
                tasks.save(t);
            });
        } catch (Exception ignored) {}

        // ✅ 대기열 갱신 이벤트 (Outbox+Idempotency)
        String effectiveCategory = (category == null || category.isBlank()) ? "UNKNOWN" : category;
        outbox.enqueue("QUEUE_CALLED", orderId, effectiveCategory, null);

        audit.write("WORKLIST_STARTED", "WORKLIST_TASK", String.valueOf(orderId), null,
                Map.of("category", effectiveCategory));
    }

    /**
     * v6: Clinical(Order 생성) -> Support(Worklist 자동 생성) 고정용 Upsert
     */
    public WorklistTask upsertTask(Long orderId, Long visitId, String category, String status, String primaryItemCode, String primaryItemName) {
        String effectiveStatus = (status == null || status.isBlank()) ? "NEW" : status;
        try {
            return tasks.findByOrderId(orderId)
                    .map(existing -> {
                        existing.setVisitId(visitId);
                        existing.setCategory(category);
                        existing.setStatus(effectiveStatus);
                        existing.setPrimaryItemCode(primaryItemCode);
                        existing.setPrimaryItemName(primaryItemName);
                        existing.setUpdatedAt(java.time.LocalDateTime.now());
                        return tasks.save(existing);
                    })
                    .orElseGet(() -> tasks.save(WorklistTask.builder()
                            .orderId(orderId)
                            .visitId(visitId)
                            .category(category)
                            .primaryItemCode(primaryItemCode)
                            .primaryItemName(primaryItemName)
                            .status(effectiveStatus)
                            .createdAt(java.time.LocalDateTime.now())
                            .build()));
        } catch (Exception e) {
            // 테이블 미적용/DB 이슈에서도 Clinical의 본 흐름이 깨지지 않게 degrade
            return WorklistTask.builder()
                    .orderId(orderId)
                    .visitId(visitId)
                    .category(category)
                    .primaryItemCode(primaryItemCode)
                    .primaryItemName(primaryItemName)
                    .status(effectiveStatus)
                    .createdAt(java.time.LocalDateTime.now())
                    .build();
        }
    }


/**
 * v7: 결과 입력 완료 시 Worklist 상태를 DONE으로 전이
 * - LAB/RAD/PROC 결과 입력 후 Worklist에서 즉시 DONE으로 보이게 하기 위한 동기화 로직
 * - worklist_task 테이블이 없거나 미적용이어도 전체 흐름이 깨지지 않도록 degrade 처리
 */
public void completeWork(Long orderId, String category) {
    if (orderId == null) return;

    try {
        tasks.findByOrderId(orderId).ifPresent(t -> {
            t.setStatus("DONE");
            t.setUpdatedAt(java.time.LocalDateTime.now());
            tasks.save(t);
        });
    } catch (Exception ignored) {}

    try {
        String effectiveCategory = (category == null || category.isBlank()) ? "UNKNOWN" : category;
        audit.write("WORKLIST_COMPLETED", "WORKLIST_TASK", String.valueOf(orderId), null,
                Map.of("category", effectiveCategory, "status", "DONE"));
    } catch (Exception ignored) {}
}
}
