type HeadersInput = { accessToken?: string; tokenType?: string };
const ADMIN_BASE = process.env.NEXT_PUBLIC_ADMIN_BASE_URL || 'http://localhost:8183';

export type DashboardSummaryServer = {
  counts: {
    waiting: number;
    reservation: number;
    emergency: number;
  };
  patients: Array<{
    visitId: number;
    patientId?: number;
    patientName?: string;
    departmentCode?: string;
    doctorId?: string;
    status?: string;
    arrivalType?: string;
    triageLevel?: number;
    createdAt?: string;
  }>;
  generatedAt?: string;
};

function authHeaders(session?: HeadersInput): Record<string, string> {
  const h: Record<string, string> = {};
  const token = session?.accessToken;
  if (token) h.Authorization = `${session?.tokenType || 'Bearer'} ${token}`;
  return h;
}

async function handleJson(res: Response): Promise<any> {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json().catch(() => ({}));
}

export async function fetchDashboardSummaryServer(args?: { session?: HeadersInput; date?: string }): Promise<DashboardSummaryServer> {
  const date = args?.date || new Date().toISOString().slice(0, 10);
  const res = await fetch(`${ADMIN_BASE}/admin/dashboard/summary?date=${encodeURIComponent(date)}`, {
    method: 'GET',
    headers: authHeaders(args?.session),
  });
  const x = await handleJson(res);
  return {
    counts: {
      waiting: Number(x?.counts?.waiting ?? 0),
      reservation: Number(x?.counts?.reservation ?? 0),
      emergency: Number(x?.counts?.emergency ?? 0),
    },
    patients: Array.isArray(x?.patients)
      ? x.patients.map((p: any) => ({
          visitId: Number(p.visitId ?? p.id ?? 0),
          patientId: p.patientId != null ? Number(p.patientId) : undefined,
          patientName: p.patientName != null ? String(p.patientName) : undefined,
          departmentCode: p.departmentCode != null ? String(p.departmentCode) : undefined,
          doctorId: p.doctorId != null ? String(p.doctorId) : undefined,
          status: p.status != null ? String(p.status) : undefined,
          arrivalType: p.arrivalType != null ? String(p.arrivalType) : undefined,
          triageLevel: p.triageLevel != null ? Number(p.triageLevel) : undefined,
          createdAt: p.createdAt != null ? String(p.createdAt) : undefined,
        })).filter((p: any) => Number.isFinite(p.visitId) && p.visitId > 0)
      : [],
    generatedAt: x?.generatedAt ? String(x.generatedAt) : undefined,
  };
}
