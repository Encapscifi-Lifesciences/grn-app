/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerSupabase, getSessionRole } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const one = (x: any) => (Array.isArray(x) ? x[0] : x);
const DAY = 86400000;

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
}

// Inventory reports: ?type=low-stock | expiry  (&days=90 for expiry window)
export async function GET(request: Request) {
  const { user, role } = await getSessionRole();
  if (!user || (role !== "warehouse" && role !== "admin")) {
    return new Response("Forbidden", { status: 403 });
  }

  const sp = new URL(request.url).searchParams;
  const type = sp.get("type") ?? "low-stock";
  const supabase = await createServerSupabase();

  const [liRes, issRes, itemRes] = await Promise.all([
    supabase
      .from("grn_line_items")
      .select("id, item_id, actual_qty, batch_no, expiry_date, expired, items(name), uoms(code), grns(grn_ref, warehouse_code)"),
    supabase.from("stock_issues").select("grn_line_item_id, qty"),
    supabase.from("items").select("id, name, min_level"),
  ]);

  const lineItems = (liRes.data ?? []) as any[];
  const issues = (issRes.data ?? []) as any[];
  const items = (itemRes.data ?? []) as any[];

  const issuedByBatch = new Map<string, number>();
  for (const s of issues)
    issuedByBatch.set(s.grn_line_item_id, (issuedByBatch.get(s.grn_line_item_id) ?? 0) + Number(s.qty));

  const batches = lineItems.map((l) => {
    const received = Number(l.actual_qty) || 0;
    const issued = issuedByBatch.get(l.id) ?? 0;
    return {
      itemId: l.item_id,
      itemName: one(l.items)?.name ?? "—",
      uom: one(l.uoms)?.code ?? "",
      batchNo: l.batch_no,
      expiryDate: l.expiry_date as string | null,
      expired: l.expired as boolean,
      available: Math.max(received - issued, 0),
      grnRef: one(l.grns)?.grn_ref ?? "—",
      warehouse: one(l.grns)?.warehouse_code ?? "",
    };
  });

  let csv: string;
  let filename: string;

  if (type === "expiry") {
    const days = Number(sp.get("days")) || 90;
    const cutoff = new Date(Date.now() + days * DAY).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    const rows = batches
      .filter((b) => !b.expired && b.available > 0 && b.expiryDate && b.expiryDate <= cutoff)
      .sort((a, b) => (a.expiryDate! < b.expiryDate! ? -1 : 1))
      .map((b) => {
        const daysLeft = Math.round((new Date(b.expiryDate!).getTime() - new Date(today).getTime()) / DAY);
        return [b.itemName, b.batchNo, b.available, b.uom, b.expiryDate, daysLeft, b.warehouse, b.grnRef];
      });
    csv = toCsv(
      ["Raw Material", "Batch/Lot", "Available", "UOM", "Expiry Date", "Days Left", "Warehouse", "GRN Ref"],
      rows
    );
    filename = `expiry-report-${days}d.csv`;
  } else {
    // low-stock
    const onHand = new Map<string, number>();
    const itemUom = new Map<string, string>();
    for (const b of batches) {
      if (!itemUom.has(b.itemId) && b.uom) itemUom.set(b.itemId, b.uom);
      if (!b.expired) onHand.set(b.itemId, (onHand.get(b.itemId) ?? 0) + b.available);
    }
    const rows = items
      .map((i) => {
        const oh = onHand.get(i.id) ?? 0;
        const min = Number(i.min_level) || 0;
        return { name: i.name, oh, min, uom: itemUom.get(i.id) ?? "", low: min > 0 && oh < min };
      })
      .filter((r) => r.low)
      .map((r) => [r.name, r.oh, r.min, r.uom, r.min - r.oh]);
    csv = toCsv(["Raw Material", "On Hand", "Min Level", "UOM", "Shortfall"], rows);
    filename = "low-stock-report.csv";
  }

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
