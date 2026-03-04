import { fromBackendVisitStatus } from '@/shared/lib/integrationBridge';
import type { VisitStatus } from '@/shared/types/domain';

type HeadersInput = { accessToken?: string; tokenType?: string };
const ADMIN_BASE = process.env.NEXT_PUBLIC_ADMIN_BASE_URL || 'http://localhost:8183';

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

function asArray(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.content)) return payload.content;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

export type SyncedReservationRow = {
  id: number;
  reservedAt: string;
  status: 'RESERVED' | 'CHECKED_IN' | 'CANCELLED';
  contactName: string;
  contactPhone: string;
};

export type SyncedVisitRow = {
  id: number;
  patientName: string;
  gender: 'M' | 'F' | '';
  rrnMasked: string;
  status: VisitStatus;
  registeredAt: string;
  visitType: 'WALK_IN' | 'RESERVATION';
};

export async function fetchReservationsServer(args: { session?: HeadersInput; date?: string }): Promise<SyncedReservationRow[]> {
  const date = args.date || new Date().toISOString().slice(0, 10);
  const res = await fetch(`${ADMIN_BASE}/admin/reservations?date=${encodeURIComponent(date)}`, {
    method: 'GET',
    headers: authHeaders(args.session),
  });
  const payload = await handleJson(res);
  return asArray(payload).map((x: any) => {
    const rawStatus = String(x.status || x.reservationStatus || 'BOOKED').toUpperCase();
    const status: SyncedReservationRow['status'] =
      rawStatus.includes('CHECK') || rawStatus === 'ARRIVED' ? 'CHECKED_IN' : rawStatus.includes('CANCEL') ? 'CANCELLED' : 'RESERVED';
    return {
      id: Number(x.reservationId ?? x.id ?? 0),
      reservedAt: String(x.scheduledAt ?? x.reservedAt ?? x.reservationAt ?? x.createdAt ?? new Date().toISOString()),
      status,
      contactName: String(x.patientName ?? x.reservationName ?? x.name ?? '-'),
      contactPhone: String(x.phone ?? x.contactPhone ?? '-'),
    };
  }).filter((r: SyncedReservationRow) => Number.isFinite(r.id) && r.id > 0);
}

export async function fetchVisitsServer(args: { session?: HeadersInput; statuses?: string[] }): Promise<SyncedVisitRow[]> {
  const query = args.statuses?.length ? `?status=${encodeURIComponent(args.statuses.join(','))}` : '';
  const res = await fetch(`${ADMIN_BASE}/admin/visits${query}`, {
    method: 'GET',
    headers: authHeaders(args.session),
  });
  const payload = await handleJson(res);
  return asArray(payload).map((x: any) => {
    const backendStatus = String(x.status ?? x.visitStatus ?? 'WAITING');
    const registeredAt = String(x.arrivedAt ?? x.registeredAt ?? x.createdAt ?? new Date().toISOString());
    const rawType = String(x.visitType ?? x.arrivalType ?? 'WALK_IN').toUpperCase();
    const genderRaw = String(x.gender ?? '').toUpperCase();
    return {
      id: Number(x.visitId ?? x.id ?? 0),
      patientName: String(x.patientName ?? x.name ?? x.reservationName ?? '-'),
      gender: genderRaw === 'M' || genderRaw === 'F' ? (genderRaw as 'M' | 'F') : '',
      rrnMasked: String(x.rrnMasked ?? x.maskedRrn ?? '******-*******'),
      status: fromBackendVisitStatus(backendStatus),
      registeredAt,
      visitType: rawType.includes('RESERV') ? 'RESERVATION' : 'WALK_IN',
    };
  }).filter((v: SyncedVisitRow) => Number.isFinite(v.id) && v.id > 0);
}
