"use client";

import { useMemo, useState } from "react";
import { GlassCard } from "@/shared/components/GlassCard";
import { RoleGate } from "@/shared/components/RoleGate";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { useHospital } from "@/shared/store/HospitalStore";
import { formatDateTime } from "@/shared/lib/date";
import { formatRrnMasked, maskName, maskPhone } from "@/shared/lib/masking";
import { STATUS_LABEL } from "@/shared/config/constants";
import { getManualVisitNextActions } from "@/shared/lib/integrationBridge";

type ReceptionTab = "RESERVATION" | "WAITING" | "EMERGENCY";

export function ReceptionScreen() {
  const { state, capacity, patientsById, addReservation, addVisit, setEmergencyCount, getUnmaskedRrn, updateVisitStatus } = useHospital();
  const [tab, setTab] = useState<ReceptionTab>("RESERVATION");
  const [selectedPatientId, setSelectedPatientId] = useState<number>(state.patients[0]?.id ?? 0);
  const [reserveTime, setReserveTime] = useState<string>("2026-03-11T10:30");
  const [visitPatientId, setVisitPatientId] = useState<number>(state.patients[1]?.id ?? 0);
  const [visitType, setVisitType] = useState<"WALK_IN" | "RESERVATION">("WALK_IN");
  const [emergencyValue, setEmergencyValue] = useState<number>(state.emergencyCount);
  const [unmaskReason, setUnmaskReason] = useState<string>("업무 확인");
  const [selectedVisitForUnmask, setSelectedVisitForUnmask] = useState<number | null>(null);
  const [unmaskResult, setUnmaskResult] = useState<string>("");
  const [toast, setToast] = useState<string>("");

  const activeReservations = useMemo(
    () => state.reservations.filter((r) => r.status === "RESERVED").sort((a, b) => a.reservedAt.localeCompare(b.reservedAt)),
    [state.reservations]
  );

  const receptionRows = useMemo(
    () => state.visits.slice().sort((a, b) => b.id - a.id),
    [state.visits]
  );

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  };

  return (
    <RoleGate allowed={["ADMIN", "SYS"]}>
      <div className="page-grid">
        <GlassCard
          title="접수"
          subtitle="원무/시스템관리자 전용 · 예약 / 대기 / 응급"
          right={<StatusBadge label={`총 인원 ${capacity.current}/30`} tone={capacity.level === "SAFE" ? "green" : capacity.level === "WARN" ? "orange" : "red"} />}
        >
          <div className="tab-row">
            {[
              { key: "RESERVATION", label: "예약" },
              { key: "WAITING", label: "대기" },
              { key: "EMERGENCY", label: "응급" },
            ].map((t) => (
              <button
                key={t.key}
                className={`tab-btn ${tab === t.key ? "is-active" : ""}`}
                onClick={() => setTab(t.key as ReceptionTab)}
                type="button"
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "RESERVATION" && (
            <div className="split-grid">
              <GlassCard title="예약 등록" className="nested-card">
                <div className="form-grid">
                  <label>
                    <span>예약자</span>
                    <select value={selectedPatientId} onChange={(e) => setSelectedPatientId(Number(e.target.value))}>
                      {state.patients.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} ({maskPhone(p.phone)})</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>예약 일시</span>
                    <input type="datetime-local" value={reserveTime} onChange={(e) => setReserveTime(e.target.value)} />
                  </label>
                </div>
                <div className="button-row">
                  <button
                    type="button"
                    className="primary-btn"
                    disabled={!capacity.canRegister}
                    onClick={() => {
                      const result = addReservation({ patientId: selectedPatientId, reservedAt: new Date(reserveTime).toISOString(), memo: "초진 예약" });
                      showToast(result.message);
                    }}
                  >
                    예약 등록
                  </button>
                  {!capacity.canRegister && <span className="warning-inline">30명 초과로 등록 차단</span>}
                </div>
              </GlassCard>

              <GlassCard title="예약 현황" subtitle="이름/전화번호 마스킹" className="nested-card">
                <div className="table-wrap">
                  <table className="ui-table compact">
                    <thead>
                      <tr>
                        <th>예약번호</th>
                        <th>예약시각</th>
                        <th>예약자</th>
                        <th>전화번호</th>
                        <th>상태</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeReservations.map((r) => {
                        const patient = patientsById[r.patientId];
                        return (
                          <tr key={r.id}>
                            <td>{r.id}</td>
                            <td>{formatDateTime(r.reservedAt)}</td>
                            <td>{patient ? `${patient.name[0]}**` : "-"}</td>
                            <td>{patient ? maskPhone(patient.phone) : "-"}</td>
                            <td>예약</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            </div>
          )}

          {tab === "WAITING" && (
            <div className="stack-col">
              <GlassCard title="접수 등록" subtitle="WALK_IN 또는 예약 내원 처리" className="nested-card">
                <div className="form-grid tri">
                  <label>
                    <span>환자 선택</span>
                    <select value={visitPatientId} onChange={(e) => setVisitPatientId(Number(e.target.value))}>
                      {state.patients.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} / {p.gender === "M" ? "남(M)" : "여(F)"} / {formatRrnMasked(p.rrnFront, p.rrnBack)}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>접수 유형</span>
                    <select value={visitType} onChange={(e) => setVisitType(e.target.value as "WALK_IN" | "RESERVATION")}>
                      <option value="WALK_IN">워크인 접수</option>
                      <option value="RESERVATION">예약 내원</option>
                    </select>
                  </label>
                  <div className="button-cell">
                    <button
                      type="button"
                      className="primary-btn"
                      disabled={!capacity.canRegister}
                      onClick={() => showToast(addVisit({ patientId: visitPatientId, visitType }).message)}
                    >
                      접수 등록
                    </button>
                  </div>
                </div>
              </GlassCard>

              <GlassCard title="접수 목록" subtitle="주민번호는 기본 마스킹 · 마스킹 해제는 ADMIN/SYS + 감사로그" className="nested-card">
                <div className="table-wrap">
                  <table className="ui-table">
                    <thead>
                      <tr>
                        <th>접수번호</th>
                        <th>환자명</th>
                        <th>성별</th>
                        <th>주민번호</th>
                        <th>상태</th>
                        <th>등록시각</th>
                        <th>상태변경</th>
                        <th>전체보기</th>
                      </tr>
                    </thead>
                    <tbody>
                      {receptionRows.map((visit) => {
                        const p = patientsById[visit.patientId];
                        if (!p) return null;
                        return (
                          <tr key={visit.id}>
                            <td>{visit.id}</td>
                            <td>{maskName(p.name)}</td>
                            <td>{p.gender === "M" ? "남(M)" : "여(F)"}</td>
                            <td>{formatRrnMasked(p.rrnFront, p.rrnBack)}</td>
                            <td>{STATUS_LABEL[visit.status]}</td>
                            <td>{formatDateTime(visit.registeredAt)}</td>
                            <td>
                              <div className="inline-btns">
                                {getManualVisitNextActions(visit.status).length === 0 ? (
                                  <span className="muted">완료됨</span>
                                ) : (
                                  getManualVisitNextActions(visit.status).map((nextStatus) => (
                                    <button
                                      key={nextStatus}
                                      type="button"
                                      onClick={() => showToast(updateVisitStatus(visit.id, nextStatus).message)}
                                    >
                                      {STATUS_LABEL[nextStatus]}
                                    </button>
                                  ))
                                )}
                              </div>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="ghost-btn"
                                onClick={() => {
                                  setSelectedVisitForUnmask(visit.id);
                                  const result = getUnmaskedRrn(visit.id, unmaskReason);
                                  setUnmaskResult(result.ok ? `${visit.id}: ${result.rrn}` : result.message);
                                }}
                              >
                                마스킹 해제
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="unmask-panel">
                  <label>
                    <span>언마스킹 사유</span>
                    <input value={unmaskReason} onChange={(e) => setUnmaskReason(e.target.value)} placeholder="업무 확인" />
                  </label>
                  <div className="muted">
                    최근 결과: {selectedVisitForUnmask ? `visit ${selectedVisitForUnmask}` : "-"} / {unmaskResult || "-"}
                  </div>
                </div>
              </GlassCard>
            </div>
          )}

          {tab === "EMERGENCY" && (
            <div className="split-grid emergency-grid">
              <GlassCard title="응급 환자 수 (A안)" subtitle="0~10 범위 / 서버에서 총 인원 30 제한 검증 예정" className="nested-card">
                <div className="counter-panel">
                  <div className="counter-big">{state.emergencyCount}명</div>
                  <input
                    type="range"
                    min={0}
                    max={10}
                    value={emergencyValue}
                    onChange={(e) => setEmergencyValue(Number(e.target.value))}
                  />
                  <div className="counter-actions">
                    <button type="button" onClick={() => setEmergencyValue((v) => Math.max(0, v - 1))}>-1</button>
                    <button type="button" onClick={() => setEmergencyValue((v) => Math.min(10, v + 1))}>+1</button>
                    <button type="button" className="primary-btn" onClick={() => showToast(setEmergencyCount(emergencyValue).message)}>
                      적용
                    </button>
                  </div>
                </div>
              </GlassCard>

              <GlassCard title="운영 상태" className="nested-card">
                <div className={`capacity-indicator ${capacity.level.toLowerCase()}`}>
                  <div className="capacity-indicator__ring" />
                  <div>
                    <strong>{capacity.current} / 30명</strong>
                    <p>
                      대기+진료중 {capacity.waitingAndInTreatment} · 예약 {capacity.reservation} · 응급 {capacity.emergency}
                    </p>
                    <p className="muted">
                      {capacity.canRegister ? "등록 가능" : "등록 차단 상태(30명 도달)"}
                    </p>
                  </div>
                </div>
              </GlassCard>
            </div>
          )}

          {toast && <div className="toast-mini">{toast}</div>}
        </GlassCard>
      </div>
    </RoleGate>
  );
}
