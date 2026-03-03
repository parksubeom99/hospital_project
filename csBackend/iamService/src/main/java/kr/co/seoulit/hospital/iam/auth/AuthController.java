package kr.co.seoulit.hospital.iam.auth;

import jakarta.servlet.http.HttpServletRequest;
import kr.co.seoulit.hospital.iam.JsonUtil;
import kr.co.seoulit.hospital.iam.audit.AuditLog;
import kr.co.seoulit.hospital.iam.audit.AuditLogRepository;
import lombok.RequiredArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import kr.co.seoulit.hospital.common.ApiErrorResponse;

@RestController
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final AuditLogRepository auditRepo;

    public record LoginRequest(String loginId, String password) {}

    @PostMapping("/auth/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest req, HttpServletRequest httpReq) {
        String ip = extractClientIp(httpReq);
        String ua = httpReq.getHeader("User-Agent");

        try {
            AuthService.LoginResult result = authService.login(req.loginId(), req.password());

            auditRepo.save(AuditLog.builder()
                    .eventId(java.util.UUID.randomUUID().toString())
                    .actorLoginId(result.loginId())
                    .serviceName("IAM")
                    .action("LOGIN")
                    .result("SUCCESS")
                    .targetType("AUTH")
                    .targetId(null)
                    .patientId(null)
                    .ipAddress(ip)
                    .userAgent(ua)
                    .detailJson(JsonUtil.toJson(
                            Map.of("roles", result.roles(), "staffId", result.staffId(), "perms", result.permissions())
                    ))
                    .createdAt(LocalDateTime.now())
                    .archived(false)
                    .build());

            return ResponseEntity.ok(result);
        } catch (AuthService.AuthFailedException afe) {
            // 내부 감사에는 상세 사유 기록(외부 응답은 단순화)
            auditRepo.save(AuditLog.builder()
                    .eventId(java.util.UUID.randomUUID().toString())
                    .actorLoginId(req.loginId())
                    .serviceName("IAM")
                    .action("LOGIN")
                    .result("FAIL")
                    .targetType("AUTH")
                    .targetId(null)
                    .patientId(null)
                    .ipAddress(ip)
                    .userAgent(ua)
                    .detailJson(JsonUtil.toJson(
                            Map.of(
                                    "reason", afe.getReason().name(),
                                    "hint", "internal-only",
                                    "loginId", req.loginId()
                            )
                    ))
                    .createdAt(LocalDateTime.now())
                    .archived(false)
                    .build());

            // 외부 응답: 이유 과노출 금지(보안)
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ApiErrorResponse("AUTH_FAILED", "로그인에 실패했습니다.", "/auth/login", LocalDateTime.now()));
        }
    }

    private String extractClientIp(HttpServletRequest req) {
        String xf = req.getHeader("X-Forwarded-For");
        if (xf != null && !xf.isBlank()) return xf.split(",")[0].trim();
        String xr = req.getHeader("X-Real-IP");
        if (xr != null && !xr.isBlank()) return xr.trim();
        return req.getRemoteAddr();
    }
}
