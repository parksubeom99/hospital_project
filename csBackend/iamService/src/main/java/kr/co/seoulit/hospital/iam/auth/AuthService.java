package kr.co.seoulit.hospital.iam.auth;

import kr.co.seoulit.hospital.iam.rba.RbacService;
import kr.co.seoulit.hospital.iam.user.UserAccount;
import kr.co.seoulit.hospital.iam.user.UserAccountRepository;
import kr.co.seoulit.hospital.iam.user.UserRole;
import kr.co.seoulit.hospital.iam.user.UserRoleRepository;
import kr.co.seoulit.hospital.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserAccountRepository userRepo;
    private final UserRoleRepository userRoleRepo;
    private final RbacService rbacService;
    private final PasswordEncoder encoder;

    @Value("${his.jwt.secret:CHANGE_ME_LOCAL_SECRET_CHANGE_ME_LOCAL_SECRET}")
    private String jwtSecret;

    public record LoginResult(String accessToken, String loginId, String staffId, List<String> roles, List<String> permissions) {}

    public enum FailReason { USER_NOT_FOUND, INACTIVE, BAD_PASSWORD }

    public static class AuthFailedException extends RuntimeException {
        private final FailReason reason;
        public AuthFailedException(FailReason reason) {
            super("AUTH_FAILED");
            this.reason = reason;
        }
        public FailReason getReason() { return reason; }
    }

    public LoginResult login(String loginId, String password) {
        UserAccount user = userRepo.findByLoginId(loginId)
                .orElseThrow(() -> new AuthFailedException(FailReason.USER_NOT_FOUND));

        if (!user.isActive()) {
            throw new AuthFailedException(FailReason.INACTIVE);
        }

        if (!encoder.matches(password, user.getPasswordHash())) {
            throw new AuthFailedException(FailReason.BAD_PASSWORD);
        }

        List<String> roles = userRoleRepo.findByUserId(user.getUserId()).stream()
                .map(UserRole::getRoleCode)
                .distinct()
                .toList();

        List<String> perms = rbacService.getPermissionsByRoles(roles);

        String token = JwtUtil.createToken(
                user.getLoginId(),
                roles,
                Map.of("staffId", user.getStaffId(), "scope", "ALL_PATIENTS", "perms", perms),
                jwtSecret,
                60L * 60L * 8L // 8시간
        );

        return new LoginResult(token, user.getLoginId(), user.getStaffId(), roles, perms);
    }
}
