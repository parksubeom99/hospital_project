package kr.co.seoulit.his.clinical.kafka;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import kr.co.seoulit.his.clinical.finalorder.FinalOrder;
import kr.co.seoulit.his.clinical.finalorder.FinalOrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Slf4j
@Component
@RequiredArgsConstructor
public class ExecutionEventConsumer {

    private final FinalOrderRepository finalOrderRepo;
    private final ProcessedEventRepository processedRepo;
    private final ObjectMapper om = new ObjectMapper();

    @KafkaListener(topics = "${kafka.topic.support-execution:support.execution.v1}")
    @Transactional
    public void onSupportExecution(String message) throws Exception {
        handleExecution(message, "support");
    }

    @KafkaListener(topics = "${kafka.topic.admin-execution:admin.execution.v1}")
    @Transactional
    public void onAdminExecution(String message) throws Exception {
        handleExecution(message, "admin");
    }

    private void handleExecution(String message, String source) throws Exception {
        JsonNode root = om.readTree(message);

        String eventId = root.path("eventId").asText();
        if (eventId == null || eventId.isBlank()) return;
        if (processedRepo.existsByEventId(eventId)) return;

        String eventType = root.path("eventType").asText();
        JsonNode payload = root.path("payload");
        long finalOrderId = payload.path("finalOrderId").asLong();

        // ✅ 상태 매핑(최소)
        String next = null;
        if (eventType == null) eventType = "";
        if (eventType.toUpperCase().contains("STARTED") || eventType.toUpperCase().contains("SCHEDULED") || eventType.toUpperCase().contains("ADMITTED")) {
            next = "IN_PROGRESS";
        } else if (eventType.toUpperCase().contains("COMPLETED") || eventType.toUpperCase().contains("DISCHARGED") || eventType.toUpperCase().contains("RECORDED")) {
            next = "DONE";
        } else {
            // TASK_CREATED 등은 상태 변경 없음
        }

        if (next != null) {
            FinalOrder fo = finalOrderRepo.findById(finalOrderId).orElse(null);
            if (fo != null) {
                String cur = fo.getStatus();
                if (!"DONE".equalsIgnoreCase(cur)) {
                    fo.setStatus(next);
                }
            }
        }

        processedRepo.save(ProcessedEvent.builder().eventId(eventId).processedAt(LocalDateTime.now()).build());
        log.info("Consumed execution event: source={}, eventId={}, finalOrderId={}, eventType={}, nextStatus={}", source, eventId, finalOrderId, eventType, next);
    }
}
