"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GlassCard } from "@/shared/components/GlassCard";
import { useHospital } from "@/shared/store/HospitalStore";

export function LoginScreen() {
  const { state, loginWithCredentials, loginWithServerCredentials, bootstrapAuthSession } = useHospital() as any;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [useRealAuth, setUseRealAuth] = useState(true);

  useEffect(() => {
    if (state.session) return;
    void (async () => {
      const result = await bootstrapAuthSession();
      if (result.ok) setMsg(result.message);
    })();
  }, [bootstrapAuthSession, state.session]);

  const onSubmit = async () => {
    setLoading(true);
    try {
      const result = useRealAuth
        ? await loginWithServerCredentials({ username: username.trim(), password })
        : loginWithCredentials({ username: username.trim(), password });
      setMsg(result.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-grid single page-grid--readable">
      <GlassCard title="로그인" subtitle="아이디/비밀번호 입력 후 권한별 로그인 (JWT Redis Refresh 연동 준비)">
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

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
          <input type="checkbox" checked={useRealAuth} onChange={(e) => setUseRealAuth(e.target.checked)} />
          <span>실서버 IAM 로그인 사용 (8181)</span>
        </label>

        <div className="button-row">
          <button type="button" className="primary-btn" onClick={onSubmit} disabled={loading}>
            {loading ? "로그인 중..." : "로그인"}
          </button>
          <Link href="/" className="header-user__ghost" style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>대시보드 이동</Link>
        </div>

        <div className="info-panel" style={{ marginTop: 10 }}>
          <div><strong>현재 상태:</strong> {state.session ? `${state.session.displayName} / ${state.session.username ?? "-"}` : "로그아웃"}</div>
          <div className="muted">시스템: sys123/system · 원무: admin123/administration · 의사: park123|kim123|lee123 / doctor</div>
          <div className="muted">기본 IAM URL: {process.env.NEXT_PUBLIC_IAM_BASE_URL ?? "http://localhost:8181"}</div>
          {state.session?.accessToken && <small className="muted">토큰: Bearer {state.session.accessToken.slice(0, 20)}...</small>}
          {msg && <div className="toast-mini" style={{ marginTop: 8 }}>{msg}</div>}
        </div>
      </GlassCard>
    </div>
  );
}
