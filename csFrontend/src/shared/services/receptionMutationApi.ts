import { toBackendVisitStatus } from "@/shared/lib/integrationBridge";
import type { VisitStatus } from "@/shared/types/domain";

type HeadersInput = { accessToken?: string; tokenType?: string };

const ADMIN_BASE = process.env.NEXT_PUBLIC_ADMIN_BASE_URL || "http://localhost:8183";

function authHeaders(session?: HeadersInput): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const token = session?.accessToken;
  if (token) h.Authorization = `${session?.tokenType || "Bearer"} ${token}`;
  return h;
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function upsertPatientForReception(args: {
  session?: HeadersInput;
  patientId: number;
  name: string;
  gender: "M" | "F";
  rrnFront: string;
  rrnBack: string;
  phone: string;
}) {
  const rrnMasked = `${args.rrnFront}-${(args.rrnBack || "").slice(0,1)}******`;
  const body = {
    patientId: args.patientId,
    name: args.name.trim(),
    gender: args.gender,
    rrnMasked,
    phone: args.phone.trim(),
    active: true,
  };
  const res = await fetch(`${ADMIN_BASE}/master/patients`, {
    method: "POST",
    headers: authHeaders(args.session),
    body: JSON.stringify(body),
  });
  return handle<any>(res);
}

export async function createReservationServer(args: {
  session?: HeadersInput;
  patientId: number;
  patientName: string;
  reservedAtIso: string;
}) {
  const body = {
    patientId: args.patientId,
    patientName: args.patientName,
    departmentCode: "IM",
    doctorId: null,
    scheduledAt: args.reservedAtIso,
  };
  const res = await fetch(`${ADMIN_BASE}/admin/reservations`, {
    method: "POST",
    headers: authHeaders(args.session),
    body: JSON.stringify(body),
  });
  return handle<any>(res);
}

export async function checkInReservationServer(args: { session?: HeadersInput; reservationId: number }) {
  const res = await fetch(`${ADMIN_BASE}/admin/reservations/${args.reservationId}/check-in`, {
    method: "POST",
    headers: authHeaders(args.session),
  });
  return handle<any>(res);
}

export async function cancelVisitServer(args: { session?: HeadersInput; visitId: number; reason?: string }) {
  const q = args.reason ? `?reason=${encodeURIComponent(args.reason)}` : "";
  const res = await fetch(`${ADMIN_BASE}/admin/visits/${args.visitId}/cancel${q}`, {
    method: "POST",
    headers: authHeaders(args.session),
  });
  return handle<any>(res);
}

export async function createVisitServer(args: {
  session?: HeadersInput;
  patientId: number;
  patientName: string;
  mode: "WALK_IN" | "RESERVATION";
}) {
  const body = {
    patientId: args.patientId,
    patientName: args.patientName,
    departmentCode: "IM",
    doctorId: null,
    arrivalType: args.mode === "WALK_IN" ? "WALK_IN" : "RESERVATION",
    triageLevel: null,
  };
  const res = await fetch(`${ADMIN_BASE}/admin/visits`, {
    method: "POST",
    headers: authHeaders(args.session),
    body: JSON.stringify(body),
  });
  return handle<any>(res);
}

export async function updateVisitServer(args: {
  session?: HeadersInput;
  visitId: number;
  patientName: string;
}) {
  const body = {
    patientName: args.patientName,
    departmentCode: "IM",
    doctorId: null,
    arrivalType: null,
    triageLevel: null,
  };
  const res = await fetch(`${ADMIN_BASE}/admin/visits/${args.visitId}`, {
    method: "PUT",
    headers: authHeaders(args.session),
    body: JSON.stringify(body),
  });
  return handle<any>(res);
}

export async function updateVisitStatusServer(args: {
  session?: HeadersInput;
  visitId: number;
  status: VisitStatus;
}) {
  const body = { status: toBackendVisitStatus(args.status) };
  const res = await fetch(`${ADMIN_BASE}/admin/visits/${args.visitId}/status`, {
    method: "POST",
    headers: authHeaders(args.session),
    body: JSON.stringify(body),
  });
  return handle<any>(res);
}
