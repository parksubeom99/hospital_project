package kr.co.seoulit.his.admin.master.master.staff;

import kr.co.seoulit.his.admin.master.audit.MasterAuditClient;
import kr.co.seoulit.his.admin.master.common.page.PageResponse;
import kr.co.seoulit.his.admin.master.master.staff.dto.StaffResponse;
import kr.co.seoulit.his.admin.master.master.staff.dto.StaffUpsertRequest;
import kr.co.seoulit.his.admin.master.master.staff.dto.StaffUpdateRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class StaffProfileService {

    private final StaffProfileRepository repo;
    private final MasterAuditClient auditClient;

    @Transactional(readOnly = true)
    public List<StaffResponse> list() {
        return repo.findAll().stream().map(this::toResponse).toList();
    }

    // 조회 표준화(검색/페이징/정렬)
    @Transactional(readOnly = true)
    public PageResponse<StaffResponse> search(String keyword, String jobType, Long departmentId, Boolean active, Pageable pageable) {
        Specification<StaffProfile> spec = Specification
                .where(StaffSpecifications.keyword(keyword))
                .and(StaffSpecifications.jobType(jobType))
                .and(StaffSpecifications.departmentId(departmentId))
                .and(StaffSpecifications.active(active));
        return PageResponse.from(repo.findAll(spec, pageable).map(this::toResponse));
    }

    @Transactional(readOnly = true)
    public StaffResponse get(Long id) {
        StaffProfile s = repo.findById(id).orElseThrow(() -> new IllegalArgumentException("StaffProfile not found: " + id));
        return toResponse(s);
    }

    @Transactional(readOnly = true)
    public StaffResponse getByLoginId(String loginId) {
        StaffProfile s = repo.findByLoginId(loginId).orElseThrow(() -> new IllegalArgumentException("StaffProfile not found by loginId: " + loginId));
        return toResponse(s);
    }

    @Transactional
    public StaffResponse upsert(StaffUpsertRequest req) {
        StaffProfile s = repo.findByLoginId(req.loginId()).orElseGet(StaffProfile::new);
        s.setLoginId(req.loginId());
        s.setName(req.name());
        s.setJobType(req.jobType());
        s.setDepartmentId(req.departmentId());
        if (req.active() != null) {
            s.setActive(req.active());
        } else if (s.getStaffProfileId() == null) {
            s.setActive(true);
        }

        StaffProfile saved = repo.save(s);

        auditClient.write("STAFF_UPSERTED", "STAFF_PROFILE", String.valueOf(saved.getStaffProfileId()), null,
                java.util.Map.of(
                        "loginId", saved.getLoginId(),
                        "name", saved.getName(),
                        "jobType", saved.getJobType(),
                        "departmentId", saved.getDepartmentId(),
                        "active", saved.isActive()
                ));

        return toResponse(saved);
    }

    @Transactional
    public StaffResponse update(Long id, StaffUpdateRequest req) {
        StaffProfile s = repo.findById(id).orElseThrow(() -> new IllegalArgumentException("StaffProfile not found: " + id));
        s.setName(req.name());
        s.setJobType(req.jobType());
        s.setDepartmentId(req.departmentId());
        if (req.active() != null) s.setActive(req.active());

        StaffProfile saved = repo.save(s);
        auditClient.write("STAFF_UPDATED", "STAFF_PROFILE", String.valueOf(saved.getStaffProfileId()), null,
                java.util.Map.of(
                        "loginId", saved.getLoginId(),
                        "name", saved.getName(),
                        "jobType", saved.getJobType(),
                        "departmentId", saved.getDepartmentId(),
                        "active", saved.isActive()
                ));
        return toResponse(saved);
    }

    // 물리삭제 대신 비활성화(현업형)
    @Transactional
    public void deactivate(Long id) {
        StaffProfile s = repo.findById(id).orElseThrow(() -> new IllegalArgumentException("StaffProfile not found: " + id));
        s.setActive(false);
        repo.save(s);
        auditClient.write("STAFF_DEACTIVATED", "STAFF_PROFILE", String.valueOf(s.getStaffProfileId()), null,
                java.util.Map.of("loginId", s.getLoginId()));
    }

    private StaffResponse toResponse(StaffProfile s) {
        return new StaffResponse(
                s.getStaffProfileId(),
                s.getLoginId(),
                s.getName(),
                s.getJobType(),
                s.getDepartmentId(),
                s.isActive()
        );
    }
}
