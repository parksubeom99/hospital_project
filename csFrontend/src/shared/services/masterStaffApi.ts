import { apiFetchWithAuth } from "@/shared/services/authApi";
import type { StaffProfile } from "@/shared/types/domain";

const ADMIN_BASE = (process.env.NEXT_PUBLIC_ADMIN_BASE_URL || "http://localhost:8183").replace(/\/$/, "");

type BackendStaff = {
  staffProfileId?: number;
  loginId?: string;
  name?: string;
  jobType?: string;
  departmentId?: number | null;
  active?: boolean;
};

type DepartmentDto = {
  departmentId?: number;
  code?: string;
  name?: string;
  active?: boolean;
};

function safeJsonParse(text: string): unknown {
  try { return JSON.parse(text); } catch { return text; }
}

async function fetchJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers ?? {});
  if (!headers.has("Content-Type") && init.method && init.method !== "GET") {
    headers.set("Content-Type", "application/json");
  }
  const res = await apiFetchWithAuth(`${ADMIN_BASE}${path}`, { ...init, headers, cache: "no-store" });
  const text = await res.text().catch(() => "");
  const data = text ? safeJsonParse(text) : undefined;
  if (!res.ok) {
    const msg = typeof data === "object" && data && "message" in (data as any)
      ? String((data as any).message)
      : text || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

function normJobType(raw: unknown): StaffProfile["jobType"] {
  const s = String(raw || "").toUpperCase();
  return s.includes("DOC") || s.includes("DOCTOR") ? "DOCTOR" : "ADMIN";
}

function inferDepartmentName(jobType: StaffProfile["jobType"], departmentId?: number | null, deptMap?: Map<number, string>): string {
  if (jobType === "ADMIN") return "원무과";
  if (departmentId && deptMap?.has(departmentId)) return String(deptMap.get(departmentId));
  return "내과";
}

function fallbackPhone(id: number) {
  return `010-${String((1000 + (id % 9000))).slice(-4)}-${String((2000 + (id % 8000))).slice(-4)}`;
}

function mapBackendToUi(x: BackendStaff, deptMap?: Map<number, string>): StaffProfile {
  const staffId = Number(x.staffProfileId ?? 0);
  const jobType = normJobType(x.jobType);
  const loginId = String(x.loginId ?? `staff${staffId}`);
  return {
    staffId,
    staffName: String(x.name ?? ""),
    jobType,
    department: inferDepartmentName(jobType, x.departmentId ?? undefined, deptMap),
    specialty: "",
    phone: fallbackPhone(staffId || 1), // 서버 필드 부재로 브리지 placeholder
    email: `${loginId}@hospital.local`, // 서버 필드 부재로 브리지 placeholder
    active: Boolean(x.active ?? true),
  };
}

export async function fetchDepartmentsServer(): Promise<Map<number, string>> {
  const rows = await fetchJson<DepartmentDto[]>(`/master/departments`, { method: "GET" });
  const map = new Map<number, string>();
  (Array.isArray(rows) ? rows : []).forEach((d) => {
    const id = Number(d.departmentId ?? 0);
    if (id > 0) map.set(id, String(d.name ?? d.code ?? `부서${id}`));
  });
  return map;
}

export async function listMasterStaffServer(): Promise<StaffProfile[]> {
  let deptMap: Map<number, string> | undefined;
  try { deptMap = await fetchDepartmentsServer(); } catch { deptMap = undefined; }
  const rows = await fetchJson<BackendStaff[]>(`/master/staff`, { method: "GET" });
  return (Array.isArray(rows) ? rows : []).map((x) => mapBackendToUi(x, deptMap)).filter((s) => s.staffId > 0);
}

function toDepartmentIdByName(department: string, jobType: StaffProfile["jobType"]): number | null {
  if (jobType === "ADMIN") return null;
  const d = String(department || "");
  if (d.includes("내과")) return 1;
  if (d.includes("외과")) return 2;
  if (d.includes("영상")) return 3;
  return null;
}

function buildLoginId(staff: StaffProfile): string {
  const base = `${staff.jobType === "DOCTOR" ? "doc" : "adm"}.${staff.staffName || "staff"}`
    .toLowerCase()
    .replace(/[^a-z0-9가-힣._-]/g, "")
    .replace(/\.+/g, ".")
    .slice(0, 24);
  return `${base || "staff"}.${Date.now().toString().slice(-6)}`;
}

export async function createMasterStaffServer(staff: StaffProfile): Promise<StaffProfile> {
  const payload = {
    loginId: buildLoginId(staff),
    name: staff.staffName,
    jobType: staff.jobType,
    departmentId: toDepartmentIdByName(staff.department, staff.jobType),
    active: staff.active,
  };
  const saved = await fetchJson<BackendStaff>(`/master/staff`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return mapBackendToUi(saved);
}

export async function updateMasterStaffServer(staff: StaffProfile): Promise<StaffProfile> {
  const payload = {
    name: staff.staffName,
    jobType: staff.jobType,
    departmentId: toDepartmentIdByName(staff.department, staff.jobType),
    active: staff.active,
  };
  const saved = await fetchJson<BackendStaff>(`/master/staff/${staff.staffId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return mapBackendToUi(saved);
}

export async function deactivateMasterStaffServer(staffId: number): Promise<void> {
  await fetchJson<void>(`/master/staff/${staffId}`, { method: "DELETE" });
}
