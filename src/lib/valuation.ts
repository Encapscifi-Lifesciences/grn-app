/* eslint-disable @typescript-eslint/no-explicit-any */
// Inventory valuation engine. Unit cost comes from the linked PO line's `rate`.
// Available qty per batch = received (actual_qty) − issued (stock_issues).

import type { SupabaseClient } from "@supabase/supabase-js";

const one = (x: any) => (Array.isArray(x) ? x[0] : x);
const DAY = 86400000;

export type BatchVal = {
  id: string;
  itemId: string;
  itemName: string;
  uom: string;
  batchNo: string | null;
  expiryDate: string | null;
  expired: boolean;
  received: number;
  issued: number;
  available: number;
  unitCost: number;
  hasCost: boolean;
  availableValue: number; // available * unitCost
  daysLeft: number | null;
};

export type ItemVal = {
  itemId: string;
  itemName: string;
  uom: string;
  onHand: number; // all available (incl. expired)
  onHandGood: number; // available, non-expired
  wacUnit: number; // weighted avg unit cost over all received qty
  actualValue: number; // Σ available * its own batch cost (specific identification)
  wacValue: number; // onHand * wacUnit
  hasMissingCost: boolean;
};

export type Valuation = {
  items: ItemVal[];
  batchesFefo: BatchVal[]; // available batches, earliest-expiry first
  totals: {
    actualValue: number;
    wacValue: number;
    goodValue: number; // non-expired available value (actual cost)
    expiredValue: number; // expired available value (write-off candidate)
    consumedValue: number; // COGS — value of issued stock
    itemsWithStock: number;
    batchesWithStock: number;
  };
  valueAtRisk: { d30: number; d60: number; d90: number }; // non-expired, expiring within window
  missingCostBatches: number; // batches with available stock but no rate
  currency: string;
};

export async function computeValuation(supabase: SupabaseClient): Promise<Valuation> {
  const [liRes, issRes] = await Promise.all([
    supabase
      .from("grn_line_items")
      .select(
        "id, item_id, actual_qty, batch_no, expiry_date, expired, po_line_items(rate), items(name), uoms(code)"
      ),
    supabase.from("stock_issues").select("grn_line_item_id, qty"),
  ]);

  const lineItems = (liRes.data ?? []) as any[];
  const issues = (issRes.data ?? []) as any[];

  const issuedByBatch = new Map<string, number>();
  for (const s of issues)
    issuedByBatch.set(s.grn_line_item_id, (issuedByBatch.get(s.grn_line_item_id) ?? 0) + Number(s.qty));

  const now = Date.now();
  const daysLeftOf = (d: string | null) =>
    d ? Math.round((new Date(d).getTime() - now) / DAY) : null;

  const batches: BatchVal[] = lineItems.map((l) => {
    const received = Number(l.actual_qty) || 0;
    const issued = issuedByBatch.get(l.id) ?? 0;
    const available = Math.max(received - issued, 0);
    const rate = one(l.po_line_items)?.rate;
    const unitCost = Number(rate) || 0;
    return {
      id: l.id,
      itemId: l.item_id,
      itemName: one(l.items)?.name ?? "—",
      uom: one(l.uoms)?.code ?? "",
      batchNo: l.batch_no ?? null,
      expiryDate: l.expiry_date ?? null,
      expired: !!l.expired,
      received,
      issued,
      available,
      unitCost,
      hasCost: rate != null && Number(rate) > 0,
      availableValue: available * unitCost,
      daysLeft: daysLeftOf(l.expiry_date ?? null),
    };
  });

  // ---- Per-item rollup ----
  const byItem = new Map<string, BatchVal[]>();
  for (const b of batches) {
    if (!byItem.has(b.itemId)) byItem.set(b.itemId, []);
    byItem.get(b.itemId)!.push(b);
  }

  const items: ItemVal[] = [];
  for (const [itemId, bs] of byItem) {
    const onHand = bs.reduce((s, b) => s + b.available, 0);
    const onHandGood = bs.reduce((s, b) => s + (b.expired ? 0 : b.available), 0);
    const totalRecv = bs.reduce((s, b) => s + b.received, 0);
    const totalRecvValue = bs.reduce((s, b) => s + b.received * b.unitCost, 0);
    const wacUnit = totalRecv > 0 ? totalRecvValue / totalRecv : 0;
    const actualValue = bs.reduce((s, b) => s + b.availableValue, 0);
    items.push({
      itemId,
      itemName: bs[0].itemName,
      uom: bs[0].uom,
      onHand,
      onHandGood,
      wacUnit,
      actualValue,
      wacValue: onHand * wacUnit,
      hasMissingCost: bs.some((b) => b.available > 0 && !b.hasCost),
    });
  }
  items.sort((a, b) => b.actualValue - a.actualValue);

  // ---- FEFO order: available batches, earliest expiry first (nulls last) ----
  const batchesFefo = batches
    .filter((b) => b.available > 0)
    .sort((a, b) => {
      if (!a.expiryDate && !b.expiryDate) return 0;
      if (!a.expiryDate) return 1;
      if (!b.expiryDate) return -1;
      return a.expiryDate < b.expiryDate ? -1 : 1;
    });

  // ---- Totals ----
  const goodValue = batches.reduce((s, b) => s + (b.expired ? 0 : b.availableValue), 0);
  const expiredValue = batches.reduce((s, b) => s + (b.expired ? b.availableValue : 0), 0);
  const consumedValue = batches.reduce((s, b) => s + b.issued * b.unitCost, 0);

  // ---- Value at risk (non-expired, expiring within window) ----
  const within = (days: number) =>
    batchesFefo
      .filter((b) => !b.expired && b.daysLeft != null && b.daysLeft >= 0 && b.daysLeft <= days)
      .reduce((s, b) => s + b.availableValue, 0);

  return {
    items,
    batchesFefo,
    totals: {
      actualValue: batches.reduce((s, b) => s + b.availableValue, 0),
      wacValue: items.reduce((s, i) => s + i.wacValue, 0),
      goodValue,
      expiredValue,
      consumedValue,
      itemsWithStock: items.filter((i) => i.onHand > 0).length,
      batchesWithStock: batchesFefo.length,
    },
    valueAtRisk: { d30: within(30), d60: within(60), d90: within(90) },
    missingCostBatches: batchesFefo.filter((b) => !b.hasCost).length,
    currency: "INR",
  };
}

export function formatINR(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}
