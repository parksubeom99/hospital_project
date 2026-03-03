# Hospital MSA Frontend (4-Service Integrated UI Demo)

Next.js 14 / React 18 / TypeScript 기반 프론트 리디자인 샘플입니다.

## 목표
- Admin + Master 통합(4서비스 전환) 기준 UI 구조 선행 구현
- 업무 메뉴 5개(접수/진료/오더/수납/마스터 설정)
- 권한 3개(DOC/ADMIN/SYS)
- 개인정보 마스킹/언마스킹(감사로그 흐름 시뮬레이션)
- 최종오더/수납 규칙(UI/상태 흐름 시뮬레이션)

## 실행
```bash
npm install
npm run dev
```

## 주요 경로
- `/` 대시보드
- `/login` 권한 로그인 시뮬레이션
- `/reception` 접수 (ADMIN/SYS)
- `/clinical` 진료 (DOC/SYS)
- `/orders` 최종오더 (DOC/SYS)
- `/billing` 수납 (ADMIN/SYS)
- `/master-settings` 마스터 설정 (ADMIN/SYS)

## 비고
현재는 **mock store 기반**입니다. 추후 실제 백엔드 연동 시 `src/shared/services/contracts.ts`를 기준으로 API adapter를 붙이면 됩니다.
