"use client";

import { useState } from "react";
import Link from "next/link";
import { GlassCard } from "@/shared/components/GlassCard";
import { useHospital } from "@/shared/store/HospitalStore";

export function LoginScreen() {
  const { state, loginWithCredentials } = useHospital() as any;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  const onSubmit = () => {
    const result = loginWithCredentials({ username: username.trim(), password });
    setMsg(result.message);
  };

  return (
    <div className="page-grid single page-grid--readable">
      <GlassCard title="로그인" subtitle="아이디/비밀번호 입력 후 권한별 로그인 (JWT 모의 토큰 발급)">
        <div className="form-grid">
          <label>
            <span>아이디</span>
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="예: sys123" />
          </label>
          <label>
            <span>비밀번호</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호" />
          </label>
        </div>

        <div className="button-row">
          <button type="button" className="primary-btn" onClick={onSubmit}>로그인</button>
          <Link href="/" className="header-user__ghost" style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>대시보드 이동</Link>
        </div>

        <div className="info-panel" style={{ marginTop: 10 }}>
          <div><strong>현재 상태:</strong> {state.session ? `${state.session.displayName} / ${state.session.username ?? "-"}` : "로그아웃"}</div>
          <div className="muted">시스템: sys123/system · 원무: admin123/administration · 의사: park123|kim123|lee123 / doctor</div>
          {state.session?.accessToken && <small className="muted">토큰: Bearer {state.session.accessToken.slice(0, 20)}...</small>}
          {msg && <div className="toast-mini" style={{ marginTop: 8 }}>{msg}</div>}
        </div>
      </GlassCard>
    </div>
  );
}
