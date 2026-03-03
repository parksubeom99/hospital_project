package kr.co.seoulit.hospital.iam.auth;

import kr.co.seoulit.hospital.iam.rba.RbacService;
import kr.co.seoulit.hospital.iam.user.UserAccount;
import kr.co.seoulit.hospital.iam.user.UserAccountRepository;
import kr.co.seoulit.hospital.iam.user.UserRole;
import kr.co.seoulit.hospital.iam.user.UserRoleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/auth")
public class AuthMeController {

    private final UserAccountRepository userRepo;
    private final UserRoleRepository userRoleRepo;
    private final RbacService rbacService;

    @GetMapping("/me")
    public MeResponse me(@RequestHeader("X-Login-Id") String loginId) {
        // NOTE: 기존 프로젝트의 서비스간 호출 패턴을 고려해 단순 헤더 기반으로 제공(내부용).
        UserAccount user = userRepo.findByLoginId(loginId)
                .orElseThrow(() -> new IllegalArgumentException("계정을 찾을 수 없습니다."));
        List<String> roles = userRoleRepo.findByUserId(user.getUserId()).stream()
                .map(UserRole::getRoleCode).distinct().toList();
        List<String> perms = rbacService.getPermissionsByRoles(roles);
        return new MeResponse(user.getUserId(), user.getLoginId(), user.getStaffId(), roles, perms);
    }

    public record MeResponse(Long userId, String loginId, String staffId, List<String> roles, List<String> permissions) {}
}
