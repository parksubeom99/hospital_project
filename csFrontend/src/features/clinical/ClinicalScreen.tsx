"use client";

import { useEffect, useMemo, useState } from "react";
import { GlassCard } from "@/shared/components/GlassCard";
import { RoleGate } from "@/shared/components/RoleGate";
import { normalizeExamSelection, useHospital, EXAM_OPTIONS } from "@/shared/store/HospitalStore";
import type { ExamCategory, ExamOrderItem } from "@/shared/types/domain";
import { formatRrnMasked, maskName } from "@/shared/lib/masking";
import { STATUS_LABEL } from "@/shared/config/constants";

export function ClinicalScreen() {
  const { state, patientsById, saveSoap, saveExamOrders } = useHospital();
  const activeVisits = useMemo(
    () => state.visits.filter(v => v.status !== "COMPLETED").sort((a, b) => b.id - a.id),
    [state.visits]
  );
  const [visitId, setVisitId] = useState<number>(activeVisits[0]?.id ?? 0);
  const currentSoap = state.soaps[visitId];
  const [soap, setSoap] = useState({
    subjective: "",
    objective: "",
    assessment: "",
    plan: "",
  });
  const [selectedItems, setSelectedItems] = useState<ExamOrderItem[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setSoap({
      subjective: currentSoap?.subjective ?? "",
      objective: currentSoap?.objective ?? "",
      assessment: currentSoap?.assessment ?? "",
      plan: currentSoap?.plan ?? "",
    });
    setSelectedItems(state.examOrders[visitId] ?? []);
  }, [visitId, currentSoap, state.examOrders]);

  const visit = activeVisits.find((v) => v.id === visitId);
  const patient = visit ? patientsById[visit.patientId] : undefined;

  const toggleItem = (category: ExamCategory, item: ExamOrderItem) => {
    setSelectedItems((prev) => {
      const exists = prev.some((p) => p.code === item.code);
      let next = exists ? prev.filter((p) => p.code !== item.code) : [...prev, item];
      const noneCode = `${category}_NONE`;
      const isNone = item.code === noneCode;
      if (isNone && !exists) {
        next = next.filter((p) => p.category !== category || p.code === noneCode);
      } else if (!isNone) {
        next = next.filter((p) => !(p.category === category && p.code === noneCode));
      }
      return normalizeExamSelection(next);
    });
  };

  const emit = (msg: string) => {
    setMessage(msg);
    window.setTimeout(() => setMessage(""), 1800);
  };

  return (
    <RoleGate allowed={["DOC", "SYS"]}>
      <div className="page-grid">
        <GlassCard title="진료" subtitle="SOAP + 검사/영상(복수 선택) · 의사/시스템관리자 전용">
          <div className="form-grid tri">
            <label>
              <span>접수 선택</span>
              <select value={visitId} onChange={(e) => setVisitId(Number(e.target.value))}>
                {activeVisits.map((v) => {
                  const p = patientsById[v.patientId];
                  return (
                    <option key={v.id} value={v.id}>
                      {v.id} / {p ? maskName(p.name) : "-"} / {v.status}
                    </option>
                  );
                })}
              </select>
            </label>
            <div className="info-pill">
              <span>환자 정보</span>
              <strong>{patient ? `${patient.name} · ${patient.gender === "M" ? "남(M)" : "여(F)"} · ${formatRrnMasked(patient.rrnFront, patient.rrnBack)}` : "선택 없음"}</strong>
              <small>상태: {visit ? STATUS_LABEL[visit.status] : "-"}</small>
            </div>
            <div className="info-pill">
              <span>연동 계약(설계안 → 현재 백엔드)</span>
              <strong>SOAP: /clinical/emr/soaps/{'{visitId}'} → 현재 /emr/soaps/{'{visitId}'}</strong>
              <small>Orders: /clinical/orders → 현재 /orders (adapter 경유 권장)</small>
            </div>
          </div>

          <div className="split-grid">
            <GlassCard title="SOAP 입력" className="nested-card">
              <div className="soap-grid">
                <label><span>S (주관적)</span><textarea value={soap.subjective} onChange={(e) => setSoap(s => ({ ...s, subjective: e.target.value }))} /></label>
                <label><span>O (객관적)</span><textarea value={soap.objective} onChange={(e) => setSoap(s => ({ ...s, objective: e.target.value }))} /></label>
                <label><span>A (평가)</span><textarea value={soap.assessment} onChange={(e) => setSoap(s => ({ ...s, assessment: e.target.value }))} /></label>
                <label><span>P (계획)</span><textarea value={soap.plan} onChange={(e) => setSoap(s => ({ ...s, plan: e.target.value }))} /></label>
              </div>
              <div className="button-row">
                <button className="primary-btn" type="button" onClick={() => emit(saveSoap(visitId, soap).message)}>SOAP 저장</button>
              </div>
            </GlassCard>

            <GlassCard title="검사 / 영상 / 시술 오더" subtitle="'없음'은 같은 그룹 내 상호배타" className="nested-card">
              <div className="order-check-grid">
                {(["LAB", "RAD", "PROC"] as ExamCategory[]).map((category) => (
                  <div key={category} className="check-panel">
                    <h4>{category === "LAB" ? "검사(LAB)" : category === "RAD" ? "영상(RAD)" : "시술/검사(PROC)"}</h4>
                    <div className="check-list">
                      {EXAM_OPTIONS[category].map((item) => {
                        const checked = selectedItems.some((s) => s.code === item.code);
                        return (
                          <label key={item.code} className={`check-item ${checked ? "is-checked" : ""}`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleItem(category, item)}
                            />
                            <span>{item.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="order-selected-list">
                <strong>선택 결과</strong>
                <ul>
                  {selectedItems.map((i) => <li key={i.code}>{i.category} · {i.name}</li>)}
                  {selectedItems.length === 0 && <li className="muted">선택 없음</li>}
                </ul>
              </div>

              <div className="button-row">
                <button className="primary-btn" type="button" onClick={() => emit(saveExamOrders(visitId, selectedItems).message)}>
                  검사/영상 오더 저장
                </button>
              </div>
            </GlassCard>
          </div>

          {message && <div className="toast-mini">{message}</div>}
        </GlassCard>
      </div>
    </RoleGate>
  );
}
