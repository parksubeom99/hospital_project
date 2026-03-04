import { toBackendVisitStatus } from '@/shared/lib/integrationBridge';
import type { VisitStatus } from '@/shared/types/domain';

type HeadersInput = { accessToken?: string; tokenType?: string };
const ADMIN_BASE = process.env.NEXT_PUBLIC_ADMIN_BASE_URL || 'http://localhost:8183';

type BackendInvoiceItem = {
  invoiceItemId?: number;
  itemCode?: string;
  itemName?: string;
  unitPrice?: number;
  qty?: number;
  lineTotal?: number;
};

export type BackendInvoice = {
  invoiceId: number;
  visitId: number;
  status: string;
  totalAmount: number;
  createdAt?: string;
  updatedAt?: string;
  items: BackendInvoiceItem[];
};

export type BackendPayment = {
  paymentId: number;
  invoiceId: number;
  method: string;
  amount: number;
  status: string;
  idempotencyKey?: string;
  paidAt?: string;
};

function authHeaders(session?: HeadersInput): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
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

export async function createInvoiceServer(args: { session?: HeadersInput; visitId: number; amount: number }) {
  const res = await fetch(`${ADMIN_BASE}/admin/billing/invoices`, {
    method: 'POST',
    headers: authHeaders(args.session),
    body: JSON.stringify({ visitId: args.visitId, amount: Math.max(0, Math.round(args.amount)) }),
  });
  const x = await handleJson(res);
  return normalizeInvoice(x);
}

export async function listInvoicesServer(args: { session?: HeadersInput; visitId?: number }): Promise<BackendInvoice[]> {
  const q = args.visitId ? `?visitId=${encodeURIComponent(String(args.visitId))}` : '';
  const res = await fetch(`${ADMIN_BASE}/admin/billing/invoices${q}`, {
    method: 'GET',
    headers: authHeaders(args.session),
  });
  const list = asArray(await handleJson(res));
  return list.map(normalizeInvoice);
}

export async function payInvoiceServer(args: { session?: HeadersInput; invoiceId: number; method: 'CARD' | 'CASH'; amount: number; idempotencyKey?: string }): Promise<BackendPayment> {
  const res = await fetch(`${ADMIN_BASE}/admin/billing/payments`, {
    method: 'POST',
    headers: authHeaders(args.session),
    body: JSON.stringify({
      invoiceId: args.invoiceId,
      method: args.method,
      amount: Math.max(0, Math.round(args.amount)),
      idempotencyKey: args.idempotencyKey,
    }),
  });
  const x = await handleJson(res);
  return {
    paymentId: Number(x.paymentId ?? 0),
    invoiceId: Number(x.invoiceId ?? args.invoiceId),
    method: String(x.method ?? args.method),
    amount: Number(x.amount ?? args.amount),
    status: String(x.status ?? ''),
    idempotencyKey: x.idempotencyKey ? String(x.idempotencyKey) : undefined,
    paidAt: x.paidAt ? String(x.paidAt) : undefined,
  };
}

export async function updateVisitStatusServer(args: { session?: HeadersInput; visitId: number; status: VisitStatus }) {
  const res = await fetch(`${ADMIN_BASE}/admin/visits/${args.visitId}/status`, {
    method: 'POST',
    headers: authHeaders(args.session),
    body: JSON.stringify({ status: toBackendVisitStatus(args.status) }),
  });
  return handleJson(res);
}

function normalizeInvoice(x: any): BackendInvoice {
  return {
    invoiceId: Number(x.invoiceId ?? x.id ?? 0),
    visitId: Number(x.visitId ?? 0),
    status: String(x.status ?? 'ISSUED'),
    totalAmount: Number(x.totalAmount ?? x.amount ?? 0),
    createdAt: x.createdAt ? String(x.createdAt) : undefined,
    updatedAt: x.updatedAt ? String(x.updatedAt) : undefined,
    items: asArray(x.items).map((it: any) => ({
      invoiceItemId: Number(it.invoiceItemId ?? it.id ?? 0) || undefined,
      itemCode: it.itemCode ? String(it.itemCode) : undefined,
      itemName: it.itemName ? String(it.itemName) : undefined,
      unitPrice: Number(it.unitPrice ?? 0),
      qty: Number(it.qty ?? 1),
      lineTotal: Number(it.lineTotal ?? (Number(it.unitPrice ?? 0) * Number(it.qty ?? 1))),
    })),
  };
}
