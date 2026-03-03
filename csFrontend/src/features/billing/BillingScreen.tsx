"use client";

import { useMemo, useState } from "react";
import { GlassCard } from "@/shared/components/GlassCard";
import { RoleGate } from "@/shared/components/RoleGate";
import { useHospital } from "@/shared/store/HospitalStore";
import { formatCurrency } from "@/shared/lib/format";
import { STATUS_LABEL } from "@/shared/config/constants";

export function BillingScreen() {
  const { state, patientsById, generateInvoiceFromFinalOrder, payInvoice } = useHospital();
  const [visitId, setVisitId] = useState<number>(() => {
    const withFinalOrder = Object.keys(state.finalOrders).map(Number);
    return withFinalOrder[0] ?? state.visits[0]?.id ?? 0;
  });
  const [message, setMessage] = useState("");

  const targetVisit = state.visits.find((v) => v.id === visitId);
  const patient = targetVisit ? patientsById[targetVisit.patientId] : undefined;

  const latestInvoice = useMemo(() => {
    return state.invoices
      .filter((i) => i.visitId === visitId)
      .sort((a, b) => b.invoiceId - a.invoiceId)[0];
  }, [state.invoices, visitId]);

  const finalOrder = state.finalOrders[visitId];

  const emit = (msg: string) => {
    setMessage(msg);
    window.setTimeout(() => setMessage(""), 2200);
  };

  return (
    <RoleGate allowed={["ADMIN", "SYS"]}>
      <div className="page-grid">
        <GlassCard title="수납" subtitle="최종오더 결과 기반 영수증 자동 산출 / 결제 처리">
          <div className="form-grid tri">
            <label>
              <span>접수 선택</span>
              <select value={visitId} onChange={(e) => setVisitId(Number(e.target.value))}>
                {state.visits.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.id} / {patientsById[v.patientId]?.name ?? "-"} / {STATUS_LABEL[v.status]}
                  </option>
                ))}
              </select>
            </label>
            <div className="info-pill">
              <span>환자</span>
              <strong>{patient ? patient.name : "선택 없음"}</strong>
              <small>결제 후 규칙: 약제만 처방이면 완료 처리</small>
            </div>
            <div className="button-row">
              <button type="button" className="primary-btn" onClick={() => emit(generateInvoiceFromFinalOrder(visitId).message)}>
                영수증 자동 생성
              </button>
            </div>
          </div>

          <div className="split-grid">
            <GlassCard title="최종오더 요약" className="nested-card">
              {!finalOrder ? (
                <div className="empty-state muted">최종오더가 없습니다.</div>
              ) : (
                <div className="summary-box">
                  <div className="summary-row"><span>유형</span><strong>{finalOrder.types.join(", ") || "-"}</strong></div>
                  {finalOrder.medications.length > 0 && (
                    <div className="summary-row">
                      <span>약제</span>
                      <strong>{finalOrder.medications.map((m) => `${m.drugName} x${m.qty}`).join(", ")}</strong>
                    </div>
                  )}
                  {finalOrder.surgery && (
                    <div className="summary-row">
                      <span>수술</span>
                      <strong>{finalOrder.surgery.surgeryType === "INTERNAL" ? "내과수술" : "외과수술"} / {finalOrder.surgery.roomNo}번실</strong>
                    </div>
                  )}
                  {finalOrder.admission && (
                    <div className="summary-row">
                      <span>입원</span>
                      <strong>{finalOrder.admission.wardNo}번 병동 / {finalOrder.admission.nights}박</strong>
                    </div>
                  )}
                </div>
              )}
            </GlassCard>

            <GlassCard title="영수증 미리보기" subtitle="약 1,000 / 내과수술 50,000 / 외과수술 100,000 / 입원 1박 10,000" className="nested-card">
              {!latestInvoice ? (
                <div className="empty-state muted">영수증이 아직 생성되지 않았습니다.</div>
              ) : (
                <>
                  <div className="table-wrap">
                    <table className="ui-table compact">
                      <thead>
                        <tr>
                          <th>항목</th>
                          <th>수량</th>
                          <th>단가</th>
                          <th>금액</th>
                          <th>비고</th>
                        </tr>
                      </thead>
                      <tbody>
                        {latestInvoice.items.map((item, idx) => (
                          <tr key={idx}>
                            <td>{item.itemName}</td>
                            <td>{item.qty}</td>
                            <td>{formatCurrency(item.unitPrice)}</td>
                            <td>{formatCurrency(item.amount)}</td>
                            <td>{item.metaLabel ?? "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="receipt-footer">
                    <div>
                      <strong>상태</strong>: {latestInvoice.status}
                    </div>
                    <div className="receipt-total">{formatCurrency(latestInvoice.totalAmount)}</div>
                  </div>
                  <div className="button-row">
                    <button type="button" onClick={() => emit(payInvoice(latestInvoice.invoiceId, "CARD").message)} disabled={latestInvoice.status === "PAID"}>
                      카드 결제
                    </button>
                    <button type="button" onClick={() => emit(payInvoice(latestInvoice.invoiceId, "CASH").message)} disabled={latestInvoice.status === "PAID"}>
                      현금 결제
                    </button>
                  </div>
                </>
              )}
            </GlassCard>
          </div>

          {message && <div className="toast-mini">{message}</div>}
        </GlassCard>
      </div>
    </RoleGate>
  );
}
