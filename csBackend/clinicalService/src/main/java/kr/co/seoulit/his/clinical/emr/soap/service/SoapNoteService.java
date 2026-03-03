package kr.co.seoulit.his.clinical.emr.soap.service;

import kr.co.seoulit.his.clinical.audit.AuditClient;
import kr.co.seoulit.his.clinical.common.CurrentUserUtil;
import kr.co.seoulit.his.clinical.emr.soap.SoapNote;
import kr.co.seoulit.his.clinical.emr.soap.SoapNoteRepository;
import kr.co.seoulit.his.clinical.emr.soap.dto.SoapArchiveRequest;
import kr.co.seoulit.his.clinical.emr.soap.dto.SoapResponse;
import kr.co.seoulit.his.clinical.emr.soap.dto.SoapUpsertRequest;
import kr.co.seoulit.his.clinical.emr.soap.dto.SoapVersionResponse;
import kr.co.seoulit.his.clinical.emr.soap.history.SoapNoteHistory;
import kr.co.seoulit.his.clinical.emr.soap.history.SoapNoteHistoryRepository;
import kr.co.seoulit.his.clinical.emr.soap.mapper.SoapNoteMapper;
import kr.co.seoulit.his.clinical.exception.BusinessException;
import kr.co.seoulit.his.clinical.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class SoapNoteService {

    private final SoapNoteRepository repo;
    private final SoapNoteHistoryRepository historyRepo;
    private final SoapNoteMapper mapper;
    private final AuditClient audit;

    @Transactional
    public SoapResponse upsert(Long visitId, SoapUpsertRequest req) {
        SoapNote note = repo.findById(visitId).orElseGet(() ->
                SoapNote.builder()
                        .visitId(visitId)
                        .createdAt(LocalDateTime.now())
                        .updatedAt(LocalDateTime.now())
                        .build()
        );

        // 기존 데이터가 createdAt이 비어있으면 보정
        if (note.getCreatedAt() == null) {
            note.setCreatedAt(note.getUpdatedAt() != null ? note.getUpdatedAt() : LocalDateTime.now());
        }
        if (note.getUpdatedAt() == null) {
            note.setUpdatedAt(LocalDateTime.now());
        }

        if (note.isArchived()) {
            throw new BusinessException(ErrorCode.INVALID_STATE, "Archived SOAP cannot be modified. visitId=" + visitId);
        }

        boolean existed = repo.existsById(visitId);

        // ✅ 기존 내용이 있으면 스냅샷을 history에 append (append-only)
        if (existed && note.getVersionNo() != null && note.getVersionNo() >= 1) {
            historyRepo.save(SoapNoteHistory.builder()
                    .visitId(visitId)
                    .versionNo(note.getVersionNo())
                    .subjective(note.getSubjective())
                    .objective(note.getObjective())
                    .assessment(note.getAssessment())
                    .plan(note.getPlan())
                    .capturedAt(LocalDateTime.now())
                    .capturedBy(CurrentUserUtil.currentLoginIdOrNull())
                    .build());
            note.setVersionNo(note.getVersionNo() + 1);
        } else {
            note.setVersionNo(1);
        }

        note.setSubjective(req.subjective());
        note.setObjective(req.objective());
        note.setAssessment(req.assessment());
        note.setPlan(req.plan());
        note.setUpdatedAt(LocalDateTime.now());

        SoapNote saved = repo.save(note);

        // ✅ 비CRUD(감사로그) - 컨트롤러 밖으로 이동
        audit.write("EMR_WRITTEN", "SOAP_NOTE", String.valueOf(saved.getVisitId()), null,
                Map.of("visitId", saved.getVisitId(), "versionNo", saved.getVersionNo()));

        return mapper.toResponse(saved);
    }

    @Transactional(readOnly = true)
    public SoapResponse get(Long visitId) {
        SoapNote note = repo.findById(visitId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "SOAP Note not found. visitId=" + visitId));
        return mapper.toResponse(note);
    }

    /**
     * [ADDED] history list: 현재 + 과거 버전들
     */
    @Transactional(readOnly = true)
    public List<SoapVersionResponse> history(Long visitId) {
        SoapNote current = repo.findById(visitId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "SOAP Note not found. visitId=" + visitId));

        List<SoapVersionResponse> out = new ArrayList<>();

        // current version
        out.add(new SoapVersionResponse(
                visitId,
                current.getVersionNo(),
                current.getUpdatedAt(),
                null,
                true
        ));

        // past versions
        for (SoapNoteHistory h : historyRepo.findByVisitIdOrderByVersionNoDesc(visitId)) {
            out.add(new SoapVersionResponse(
                    visitId,
                    h.getVersionNo(),
                    h.getCapturedAt(),
                    h.getCapturedBy(),
                    false
            ));
        }
        return out;
    }

    /**
     * [ADDED] 특정 버전 조회
     */
    @Transactional(readOnly = true)
    public SoapResponse getVersion(Long visitId, Integer versionNo) {
        SoapNote current = repo.findById(visitId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "SOAP Note not found. visitId=" + visitId));

        if (current.getVersionNo() != null && current.getVersionNo().equals(versionNo)) {
            return mapper.toResponse(current);
        }

        SoapNoteHistory h = historyRepo.findByVisitIdAndVersionNo(visitId, versionNo)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND,
                        "SOAP version not found. visitId=" + visitId + ", versionNo=" + versionNo));

        // version 응답은 SoapResponse 형태를 유지하되, archived/metadata는 current 기준으로 반환
        return new SoapResponse(
                visitId,
                h.getSubjective(),
                h.getObjective(),
                h.getAssessment(),
                h.getPlan(),
                versionNo,
                current.isArchived(),
                current.getCreatedAt(),
                h.getCapturedAt(),
                current.getArchivedAt(),
                current.getArchivedBy(),
                current.getArchivedReason()
        );
    }

    /**
     * [ADDED] Archive: 물리삭제 대신 보관(수정 금지)
     */
    @Transactional
    public SoapResponse archive(Long visitId, SoapArchiveRequest req) {
        SoapNote note = repo.findById(visitId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "SOAP Note not found. visitId=" + visitId));

        if (note.isArchived()) {
            return mapper.toResponse(note);
        }

        note.setArchived(true);
        note.setArchivedAt(LocalDateTime.now());
        note.setArchivedBy(CurrentUserUtil.currentLoginIdOrNull());
        note.setArchivedReason(req == null ? null : req.reason());
        note.setUpdatedAt(LocalDateTime.now());

        SoapNote saved = repo.save(note);

        audit.write("SOAP_ARCHIVED", "SOAP_NOTE", String.valueOf(saved.getVisitId()), null,
                Map.of("visitId", saved.getVisitId(), "archived", true));

        return mapper.toResponse(saved);
    }
}
