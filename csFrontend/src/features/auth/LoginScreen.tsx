"use client";

import { GlassCard } from "@/shared/components/GlassCard";
import { useHospital } from "@/shared/store/HospitalStore";
import type { RoleCode } from "@/shared/types/domain";
import { ROLE_LABEL } from "@/shared/config/constants";
import Link from "next/link";

const roleCards: Array<{ role: RoleCode; desc: string; routes: string }> = [
  { role: "DOC", desc: "진료 / 오더 화면 접근", routes: "/clinical, /orders" },
  { role: "ADMIN", desc: "접수 / 수납 / 마스터 설정 접근", routes: "/reception, /billing, /master-settings" },
  { role: "SYS", desc: "전체 화면 접근 + 운영 점검", routes: "모든 메뉴" },
];

export function LoginScreen() {
  const { state, loginAs } = useHospital();

  return (
    <div className="page-grid single">
      <GlassCard
        title="로그인 (권한 시뮬레이션)"
        subtitle="의사(DOC) / 원무(ADMIN) / 시스템관리자(SYS) 3개 권한만 운영"
      >
        <div className="role-card-grid">
          {roleCards.map((item) => (
            <button
              key={item.role}
              type="button"
              className="role-card"
              onClick={() => loginAs(item.role)}
            >
              <div className="role-card__head">
                <strong>{ROLE_LABEL[item.role]} ({item.role})</strong>
              </div>
              <p>{item.desc}</p>
              <small>허용 메뉴: {item.routes}</small>
            </button>
          ))}
        </div>

        <div className="info-panel">
          <div>
            <strong>현재 로그인:</strong> {state.session ? `${state.session.displayName} (${state.session.role})` : "없음"}
          </div>
          <p className="muted">
            접수 화면은 ADMIN/SYS만, 진료 화면은 DOC/SYS만 접근 가능하도록 권한 가드가 적용됩니다.
          </p>
          <Link href="/" className="inline-link">대시보드로 이동</Link>
        </div>
      </GlassCard>
    </div>
  );
}
