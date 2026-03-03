"use client";

import { useMemo, useState } from "react";
import { GlassCard } from "@/shared/components/GlassCard";
import { RoleGate } from "@/shared/components/RoleGate";
import { useHospital } from "@/shared/store/HospitalStore";
import type { StaffProfile } from "@/shared/types/domain";

function emptyForm(): StaffProfile {
  return {
    staffId: 0,
    staffName: "",
    jobType: "DOCTOR",
    department: "",
    specialty: "",
    phone: "",
    email: "",
    active: true,
  };
}

export function MasterSettingsScreen() {
  const { state, upsertStaff, removeStaff } = useHospital();
  const [jobFilter, setJobFilter] = useState<"ALL" | "DOCTOR" | "ADMIN">("ALL");
  const [form, setForm] = useState<StaffProfile>(emptyForm());
  const [message, setMessage] = useState("");

  const rows = useMemo(
    () => state.staff.filter((s) => (jobFilter === "ALL" ? true : s.jobType === jobFilter)),
    [state.staff, jobFilter]
  );

  const emit = (msg: string) => {
    setMessage(msg);
    window.setTimeout(() => setMessage(""), 1800);
  };

  const onSubmit = () => {
    if (!form.staffName.trim()) return emit("직원명을 입력해주세요.");
    emit(upsertStaff(form).message);
    setForm(emptyForm());
  };

  return (
    <RoleGate allowed={["ADMIN", "SYS"]}>
      <div className="page-grid">
        <GlassCard title="마스터 설정" subtitle="의사/원무 직원 프로필 조회·등록·수정·삭제 (사진/MinIO는 후속)">
          <div className="split-grid">
            <GlassCard title="프로필 등록/수정" className="nested-card">
              <div className="form-grid tri">
                <label>
                  <span>직무</span>
                  <select value={form.jobType} onChange={(e) => setForm((f) => ({ ...f, jobType: e.target.value as "DOCTOR" | "ADMIN" }))}>
                    <option value="DOCTOR">의사</option>
                    <option value="ADMIN">원무</option>
                  </select>
                </label>
                <label>
                  <span>직원명</span>
                  <input value={form.staffName} onChange={(e) => setForm((f) => ({ ...f, staffName: e.target.value }))} />
                </label>
                <label>
                  <span>부서명</span>
                  <input value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} />
                </label>
                <label>
                  <span>전문분야</span>
                  <input value={form.specialty ?? ""} onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))} />
                </label>
                <label>
                  <span>연락처</span>
                  <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                </label>
                <label>
                  <span>이메일</span>
                  <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                </label>
              </div>
              <div className="button-row">
                <button type="button" className="primary-btn" onClick={onSubmit}>{form.staffId ? "수정 저장" : "신규 등록"}</button>
                <button type="button" onClick={() => setForm(emptyForm())}>초기화</button>
              </div>
            </GlassCard>

            <GlassCard title="프로필 목록" subtitle="의사 3명 + 원무 직원 예시 포함" className="nested-card">
              <div className="button-row">
                <button type="button" className={jobFilter === "ALL" ? "active-btn" : ""} onClick={() => setJobFilter("ALL")}>전체</button>
                <button type="button" className={jobFilter === "DOCTOR" ? "active-btn" : ""} onClick={() => setJobFilter("DOCTOR")}>의사</button>
                <button type="button" className={jobFilter === "ADMIN" ? "active-btn" : ""} onClick={() => setJobFilter("ADMIN")}>원무</button>
              </div>
              <div className="table-wrap">
                <table className="ui-table compact">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>직무</th>
                      <th>직원명</th>
                      <th>부서</th>
                      <th>전문분야</th>
                      <th>연락처</th>
                      <th>이메일</th>
                      <th>관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((s) => (
                      <tr key={s.staffId}>
                        <td>{s.staffId}</td>
                        <td>{s.jobType === "DOCTOR" ? "의사" : "원무"}</td>
                        <td>{s.staffName}</td>
                        <td>{s.department}</td>
                        <td>{s.specialty || "-"}</td>
                        <td>{s.phone}</td>
                        <td>{s.email}</td>
                        <td>
                          <div className="inline-btns">
                            <button type="button" onClick={() => setForm(s)}>수정</button>
                            <button type="button" onClick={() => emit(removeStaff(s.staffId).message)}>삭제</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {rows.length === 0 && <tr><td colSpan={8} className="empty-cell">데이터 없음</td></tr>}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          </div>

          {message && <div className="toast-mini">{message}</div>}
        </GlassCard>
      </div>
    </RoleGate>
  );
}
