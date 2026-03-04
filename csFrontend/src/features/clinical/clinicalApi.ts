import type { ExamCategory, ExamOrderItem } from '@/shared/types/domain';

const CLINICAL_BASE = process.env.NEXT_PUBLIC_CLINICAL_BASE_URL || 'http://localhost:8184';

type HeadersInput = { accessToken?: string; tokenType?: string };

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

function safeArray(v: any): any[] {
  if (Array.isArray(v)) return v;
  if (Array.isArray(v?.data)) return v.data;
  return [];
}

function categoryLabel(cat: ExamCategory): string {
  return cat === 'LAB' ? '기본검사' : cat === 'RAD' ? '영상검사' : '내시경검사';
}

export async function getSoapServer(args: { session?: HeadersInput; visitId: number }) {
  const res = await fetch(`${CLINICAL_BASE}/emr/soaps/${args.visitId}`, { headers: authHeaders(args.session) });
  const x = await handleJson(res);
  return {
    visitId: Number(x.visitId ?? args.visitId),
    subjective: String(x.subjective ?? ''),
    objective: String(x.objective ?? ''),
    assessment: String(x.assessment ?? ''),
    plan: String(x.plan ?? ''),
    updatedAt: String(x.updatedAt ?? new Date().toISOString()),
  };
}

export async function saveSoapServer(args: { session?: HeadersInput; visitId: number; soap: { subjective: string; objective: string; assessment: string; plan: string } }) {
  const res = await fetch(`${CLINICAL_BASE}/emr/soaps/${args.visitId}`, {
    method: 'PUT', headers: authHeaders(args.session), body: JSON.stringify(args.soap),
  });
  return handleJson(res);
}

export async function getExamOrdersByVisitServer(args: { session?: HeadersInput; visitId: number }): Promise<ExamOrderItem[]> {
  const listRes = await fetch(`${CLINICAL_BASE}/orders`, { headers: authHeaders(args.session) });
  const headers = safeArray(await handleJson(listRes));
  const target = headers.filter((h) => Number(h.visitId) === args.visitId && !String(h.status || '').toUpperCase().includes('CANCEL'));
  const out: ExamOrderItem[] = [];
  for (const h of target) {
    const cat = String(h.category || '').toUpperCase();
    if (!(cat === 'LAB' || cat === 'RAD' || cat === 'PROC')) continue;
    const itemsRes = await fetch(`${CLINICAL_BASE}/orders/${h.orderId}/items`, { headers: authHeaders(args.session) });
    const items = safeArray(await handleJson(itemsRes));
    for (const it of items) {
      out.push({
        category: cat as ExamCategory,
        code: String(it.itemCode ?? `${cat}_ITEM`),
        name: String(it.itemName ?? categoryLabel(cat as ExamCategory)),
      });
    }
  }
  return out;
}

async function findExistingOrder(args: { session?: HeadersInput; visitId: number; category: ExamCategory }) {
  const res = await fetch(`${CLINICAL_BASE}/orders`, { headers: authHeaders(args.session) });
  const list = safeArray(await handleJson(res));
  return list
    .filter((x) => Number(x.visitId) === args.visitId && String(x.category || '').toUpperCase() === args.category)
    .sort((a, b) => Number(b.orderId || 0) - Number(a.orderId || 0))[0];
}

export async function saveExamOrdersByVisitServer(args: { session?: HeadersInput; visitId: number; items: ExamOrderItem[] }) {
  const byCat: Record<ExamCategory, ExamOrderItem[]> = { LAB: [], RAD: [], PROC: [] };
  args.items.forEach((i) => byCat[i.category].push(i));
  const results: any[] = [];

  for (const cat of ['LAB', 'RAD', 'PROC'] as ExamCategory[]) {
    const items = byCat[cat];
    if (!items.length) continue;

    const existing = await findExistingOrder({ session: args.session, visitId: args.visitId, category: cat });
    if (existing && String(existing.status || '').toUpperCase() === 'NEW') {
      const res = await fetch(`${CLINICAL_BASE}/orders/${existing.orderId}/items`, {
        method: 'PUT', headers: authHeaders(args.session),
        body: JSON.stringify({ items: items.map((i) => ({ itemCode: i.code, itemName: i.name, qty: 1 })) }),
      });
      results.push(await handleJson(res));
      continue;
    }

    const idempotencyKey = `front-step3-${args.visitId}-${cat}-${Date.now()}`;
    const res = await fetch(`${CLINICAL_BASE}/orders`, {
      method: 'POST', headers: authHeaders(args.session),
      body: JSON.stringify({
        visitId: args.visitId,
        category: cat,
        idempotencyKey,
        items: items.map((i) => ({ itemCode: i.code, itemName: i.name, qty: 1 })),
      }),
    });
    results.push(await handleJson(res));
  }
  return results;
}

export async function getFinalOrdersByVisitServer(args: { session?: HeadersInput; visitId: number }) {
  const res = await fetch(`${CLINICAL_BASE}/final-orders`, { headers: authHeaders(args.session) });
  const list = safeArray(await handleJson(res));
  return list.filter((x) => Number(x.visitId) === args.visitId).sort((a, b) => Number(b.finalOrderId || 0) - Number(a.finalOrderId || 0));
}

export async function saveAndFinalizeFinalOrdersServer(args: { session?: HeadersInput; visitId: number; types: string[]; note?: string }) {
  const saved: any[] = [];
  for (const type of args.types) {
    const createRes = await fetch(`${CLINICAL_BASE}/final-orders`, {
      method: 'POST', headers: authHeaders(args.session),
      body: JSON.stringify({
        visitId: args.visitId,
        type,
        note: args.note ?? `front-step3 ${type}`,
        idempotencyKey: `front-final-${args.visitId}-${type}-${Date.now()}`,
      }),
    });
    const created = await handleJson(createRes);
    const id = Number(created.finalOrderId ?? created.id ?? 0);
    if (id > 0) {
      const finRes = await fetch(`${CLINICAL_BASE}/final-orders/${id}/finalize`, {
        method: 'POST', headers: authHeaders(args.session),
      });
      saved.push(await handleJson(finRes));
    } else {
      saved.push(created);
    }
  }
  return saved;
}
