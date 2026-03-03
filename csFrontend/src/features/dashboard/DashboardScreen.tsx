"use client";

import { GlassCard } from "@/shared/components/GlassCard";
import { Donut3D } from "@/shared/components/Donut3D";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { useHospital } from "@/shared/store/HospitalStore";
import { maskName, maskReservationName, maskPhone, formatRrnMasked } from "@/shared/lib/masking";
import { formatDateTime } from "@/shared/lib/date";
import { STATUS_LABEL } from "@/shared/config/constants";

export function DashboardScreen() {
  const { state, capacity, patientsById } = useHospital();

  const receptionRows = state.visits
    .slice()
    .sort((a, b) => b.id - a.id)
    .slice(0, 10)
    .map((visit) => {
      const patient = patientsById[visit.patientId];
      return {
        visitId: visit.id,
        patientNameMasked: patient ? maskName(patient.name) : "-",
        genderLabel: patient ? (patient.gender === "M" ? "남(M)" : "여(F)") : "-",
        rrnMasked: patient ? formatRrnMasked(patient.rrnFront, patient.rrnBack) : "-",
        status: STATUS_LABEL[visit.status],
        registeredAt: visit.registeredAt,
      };
    });

  const reservationRows = state.reservations
    .filter((r) => r.status === "RESERVED")
    .slice()
    .sort((a, b) => a.reservedAt.localeCompare(b.reservedAt))
    .slice(0, 10)
    .map((r) => {
      const patient = patientsById[r.patientId];
      return {
        reservationId: r.id,
        reservedAt: r.reservedAt,
        nameMasked: patient ? maskReservationName(patient.name) : "-",
        phoneMasked: patient ? maskPhone(patient.phone) : "-",
      };
    });

  const levelTone = capacity.level === "SAFE" ? "green" : capacity.level === "WARN" ? "orange" : "red";

  return (
    <div className="page-grid">
      <GlassCard
        title="대시보드"
        subtitle="환자 접수 현황 / 예약 현황은 조회 전용"
        right={<StatusBadge label={`${capacity.level} · ${capacity.canRegister ? "등록 가능" : "등록 차단"}`} tone={levelTone as any} />}
      >
        <div className="dashboard-grid">
          <div>
            <Donut3D
              waitingAndInTreatment={capacity.waitingAndInTreatment}
              reservation={capacity.reservation}
              emergency={capacity.emergency}
              current={capacity.current}
              max={capacity.max}
              level={capacity.level}
            />
            <div className={`capacity-banner ${capacity.level.toLowerCase()}`}>
              <div>
                <strong>운영 제한 규칙</strong>
                <p>총 인원 = 대기 + 진료중 + 예약 + 응급 (최대 30명)</p>
              </div>
              <div className="capacity-banner__count">{capacity.current} / 30</div>
            </div>
          </div>

          <div className="stack-col">
            <GlassCard title="환자 접수 현황" subtitle="대시보드에서는 등록/수정 불가" className="nested-card">
              <div className="table-wrap">
                <table className="ui-table compact">
                  <thead>
                    <tr>
                      <th>접수번호</th>
                      <th>환자명</th>
                      <th>성별</th>
                      <th>주민번호</th>
                      <th>상태</th>
                      <th>등록시각</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receptionRows.map((r) => (
                      <tr key={r.visitId}>
                        <td>{r.visitId}</td>
                        <td>{r.patientNameMasked}</td>
                        <td>{r.genderLabel}</td>
                        <td>{r.rrnMasked}</td>
                        <td>{r.status}</td>
                        <td>{formatDateTime(r.registeredAt)}</td>
                      </tr>
                    ))}
                    {receptionRows.length === 0 && (
                      <tr><td colSpan={6} className="empty-cell">데이터 없음</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </GlassCard>

            <GlassCard title="예약 현황" subtitle="예약자명/전화번호 마스킹 표시" className="nested-card">
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
                    {reservationRows.map((r) => (
                      <tr key={r.reservationId}>
                        <td>{r.reservationId}</td>
                        <td>{formatDateTime(r.reservedAt)}</td>
                        <td>{r.nameMasked}</td>
                        <td>{r.phoneMasked}</td>
                        <td>예약</td>
                      </tr>
                    ))}
                    {reservationRows.length === 0 && (
                      <tr><td colSpan={5} className="empty-cell">데이터 없음</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
