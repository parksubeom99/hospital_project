package kr.co.seoulit.his.admin.frontoffice.visit;

import kr.co.seoulit.his.admin.audit.AuditClient;
import kr.co.seoulit.his.admin.exception.BusinessException;
import kr.co.seoulit.his.admin.exception.ErrorCode;
import kr.co.seoulit.his.admin.frontoffice.billing.invoice.InvoiceRepository;
import kr.co.seoulit.his.admin.frontoffice.queue.QueueService;
import kr.co.seoulit.his.admin.frontoffice.visit.dto.VisitCreateRequest;
import kr.co.seoulit.his.admin.frontoffice.visit.dto.VisitResponse;
import kr.co.seoulit.his.admin.frontoffice.visit.dto.VisitStatusUpdateRequest;
import kr.co.seoulit.his.admin.frontoffice.visit.dto.VisitUpdateRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class VisitService {

    private final VisitRepository visits;
    private final InvoiceRepository invoices;
    private final QueueService queue;
    private final AuditClient audit;

    @Transactional
    public VisitResponse create(VisitCreateRequest req) {
        Visit v = Visit.builder()
                .patientId(req.patientId())
                .patientName(req.patientName())
                .departmentCode(req.departmentCode())
                .doctorId(req.doctorId())
                // [CHANGED] Emergency(B안)
                .arrivalType(req.arrivalType())
                .triageLevel(req.triageLevel())
                .status("CREATED")
                .createdAt(LocalDateTime.now())
                .build();
        Visit saved = visits.save(v);

        // ✅ 자동 대기표 생성(진료과/창구를 category로 사용)
        String category = (saved.getDepartmentCode() == null || saved.getDepartmentCode().isBlank())
                ? "FRONT"
                : saved.getDepartmentCode();
        queue.ensureTicket(saved.getVisitId(), category, "WAITING");

        // visit는 WAITING으로 승격 (단, CANCEL/CLOSE가 아닌 경우)
        saved.setStatus("WAITING");
        saved.setUpdatedAt(LocalDateTime.now());
        visits.save(saved);

        audit.write("VISIT_CREATED", "VISIT", String.valueOf(saved.getVisitId()), null,
                Map.of("patientId", String.valueOf(saved.getPatientId()), "status", saved.getStatus(), "category", category));

        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public VisitResponse get(Long visitId) {
        Visit v = visits.findById(visitId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Visit not found. visitId=" + visitId));
        return toResponse(v);
    }

    @Transactional(readOnly = true)
    public List<VisitResponse> list(String status) {
        List<Visit> list = (status == null) ? visits.findAll() : visits.findByStatus(status);
        return list.stream().map(this::toResponse).toList();
    }

    @Transactional
    public VisitResponse update(Long visitId, VisitUpdateRequest req) {
        Visit v = visits.findById(visitId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Visit not found. visitId=" + visitId));

        if (req.patientName() != null) v.setPatientName(req.patientName());
        if (req.departmentCode() != null) v.setDepartmentCode(req.departmentCode());
        if (req.doctorId() != null) v.setDoctorId(req.doctorId());
        // [CHANGED] Emergency(B안)
        if (req.arrivalType() != null) v.setArrivalType(req.arrivalType());
        if (req.triageLevel() != null) v.setTriageLevel(req.triageLevel());

        v.setUpdatedAt(LocalDateTime.now());
        Visit saved = visits.save(v);

        audit.write("VISIT_UPDATED", "VISIT", String.valueOf(saved.getVisitId()), null,
                Map.of("status", saved.getStatus()));

        return toResponse(saved);
    }

    /**
     * 상태 변경(기존 호환): status 문자열을 받되, 허용 전이만 통과시킵니다.
     */
    @Transactional
    public VisitResponse updateStatus(Long visitId, VisitStatusUpdateRequest req) {
        Visit v = visits.findById(visitId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Visit not found. visitId=" + visitId));

        String from = norm(v.getStatus());
        String to = norm(req.status());

        if (!isAllowed(from, to)) {
            throw new BusinessException(ErrorCode.INVALID_STATE, "Invalid visit transition: " + from + " -> " + to);
        }

        applyStatus(v, to, null);
        Visit saved = visits.save(v);

        audit.write("VISIT_STATUS_CHANGED", "VISIT", String.valueOf(saved.getVisitId()), null,
                Map.of("from", from, "to", to));

        return toResponse(saved);
    }

    @Transactional
    public VisitResponse cancel(Long visitId, String reason) {
        Visit v = visits.findById(visitId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Visit not found. visitId=" + visitId));

        String st = norm(v.getStatus());
        if (!"WAITING".equals(st)) {
            throw new BusinessException(ErrorCode.INVALID_STATE, "Only WAITING visit can be canceled. status=" + st);
        }

        // 결제(PAID)가 있으면 취소 불가(현업 기본)
        boolean hasPaid = invoices.existsByVisitIdAndStatus(visitId, "PAID");
        if (hasPaid) {
            throw new BusinessException(ErrorCode.INVALID_STATE, "Cannot cancel. PAID invoice exists.");
        }

        applyStatus(v, "CANCELED", reason);
        Visit saved = visits.save(v);

        audit.write("VISIT_CANCELED", "VISIT", String.valueOf(saved.getVisitId()), null,
                Map.of("reason", reason == null ? "" : reason));

        return toResponse(saved);
    }

    private void applyStatus(Visit v, String to, String reason) {
        v.setStatus(to);
        v.setUpdatedAt(LocalDateTime.now());
        if ("CANCELED".equals(to)) {
            v.setCanceledAt(LocalDateTime.now());
            v.setCancelReason(reason);
        }
        if ("CLOSED".equals(to)) {
            v.setClosedAt(LocalDateTime.now());
        }
    }

    private static String norm(String s) {
        if (s == null) return "";
        String x = s.trim().toUpperCase();
        // 과거 READY는 WAITING으로 정규화
        if ("READY".equals(x)) return "WAITING";
        return x;
    }

    private static boolean isAllowed(String from, String to) {
        if (from.equals(to)) return true;
        return switch (from) {
            case "CREATED" -> to.equals("WAITING") || to.equals("CANCELED");
            case "WAITING" -> to.equals("CALLED") || to.equals("CANCELED") || to.equals("CLOSED");
            case "CALLED" -> to.equals("CLOSED");
            case "IN_PROGRESS" -> to.equals("CLOSED");
            default -> false;
        };
    }

    private VisitResponse toResponse(Visit v) {
        return new VisitResponse(
                v.getVisitId(),
                v.getPatientId(),
                v.getPatientName(),
                v.getDepartmentCode(),
                v.getDoctorId(),
                v.getStatus(),
                // [CHANGED] Emergency(B안)
                v.getArrivalType(),
                v.getTriageLevel(),
                v.getCreatedAt(),
                v.getUpdatedAt(),
                v.getCanceledAt(),
                v.getCancelReason(),
                v.getClosedAt()
        );
    }
}
