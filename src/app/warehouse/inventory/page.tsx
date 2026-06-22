/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { requireRole, createServerSupabase } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { InventoryActions } from "./InventoryActions";
import { IssueButton } from "./IssueButton";
import { MinLevelInput } from "./MinLevelInput";

export const dynamic = "force-dynamic";

const one = (x: any) => (Array.isArray(x) ? x[0] : x);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const DAY = 86400000;

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { user } = await requireRole(["warehouse"]);
  const { view } = await searchParams;
  const active = view ?? "stock";
  const supabase = await createServerSupabase();

  const [liRes, issRes, itemRes] = await Promise.all([
    supabase
      .from("grn_line_items")
      .select(
        "id, item_id, actual_qty, batch_no, expiry_date, expired, expiry_proof_url, " +
          "items(name), uoms(code), grns(grn_ref, warehouse_code, grn_date)"
      ),
    supabase.from("stock_issues").select("grn_line_item_id, qty"),
    supabase.from("items").select("id, name, min_level"),
  ]);

  const lineItems = (liRes.data ?? []) as any[];
  const issues = (issRes.data ?? []) as any[];
  const items = (itemRes.data ?? []) as any[];

  // issued qty per batch
  const issuedByBatch = new Map<string, number>();
  for (const s of issues)
    issuedByBatch.set(s.grn_line_item_id, (issuedByBatch.get(s.grn_line_item_id) ?? 0) + Number(s.qty));

  // batches with available qty
  const batches = lineItems.map((l) => {
    const received = Number(l.actual_qty) || 0;
    const issued = issuedByBatch.get(l.id) ?? 0;
    return {
      id: l.id,
      itemId: l.item_id,
      itemName: one(l.items)?.name ?? "—",
      uom: one(l.uoms)?.code ?? "",
      batchNo: l.batch_no,
      expiryDate: l.expiry_date as string | null,
      expired: l.expired as boolean,
      proofUrl: l.expiry_proof_url as string | null,
      received,
      issued,
      available: Math.max(received - issued, 0),
      grnRef: one(l.grns)?.grn_ref ?? "—",
      warehouse: one(l.grns)?.warehouse_code ?? "",
    };
  });

  // dates
  const today = new Date();
  const todayStr = iso(today);
  const d30 = iso(new Date(today.getTime() + 30 * DAY));
  const d60 = iso(new Date(today.getTime() + 60 * DAY));
  const d90 = iso(new Date(today.getTime() + 90 * DAY));
  const daysLeft = (d: string | null) =>
    d ? Math.round((new Date(d).getTime() - today.getTime()) / DAY) : null;

  // per-item on-hand (non-expired) + uom
  const onHand = new Map<string, number>();
  const itemUom = new Map<string, string>();
  for (const b of batches) {
    if (!itemUom.has(b.itemId) && b.uom) itemUom.set(b.itemId, b.uom);
    if (!b.expired) onHand.set(b.itemId, (onHand.get(b.itemId) ?? 0) + b.available);
  }
  const itemRows = items.map((i) => {
    const oh = onHand.get(i.id) ?? 0;
    const min = Number(i.min_level) || 0;
    return { id: i.id, name: i.name, onHand: oh, min, uom: itemUom.get(i.id) ?? "", low: min > 0 && oh < min };
  });

  // alert sets
  const expiringSoon = batches
    .filter((b) => !b.expired && b.available > 0 && b.expiryDate && b.expiryDate <= d90)
    .sort((a, b) => (a.expiryDate! < b.expiryDate! ? -1 : 1));
  const fefo = batches
    .filter((b) => !b.expired && b.available > 0)
    .sort((a, b) => {
      if (!a.expiryDate) return 1;
      if (!b.expiryDate) return -1;
      return a.expiryDate < b.expiryDate ? -1 : 1;
    });
  const expiredBatches = batches.filter((b) => b.expired);
  const lowItems = itemRows.filter((r) => r.low);
  const count30 = expiringSoon.filter((b) => b.expiryDate! <= d30).length;

  const tabs = [
    { k: "stock", label: "Stock Balance" },
    { k: "batches", label: "Batches" },
    { k: "fefo", label: "FEFO" },
    { k: "expiring", label: "Expiring Soon" },
    { k: "expired", label: "Expired" },
  ];

  const th = "px-4 py-3 font-medium";
  const td = "px-4 py-3";

  return (
    <div className="flex flex-1 flex-col bg-zinc-100">
      <AppHeader title="Warehouse · Inventory" email={user.email} back />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-4 p-4 sm:p-6">
        {/* Alerts summary */}
        <div className="grid gap-3 sm:grid-cols-3">
          <Link href="/warehouse/inventory?view=expiring" className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-2xl font-semibold text-red-600">{count30}</p>
            <p className="text-sm text-zinc-500">Expiring within 30 days</p>
          </Link>
          <Link href="/warehouse/inventory?view=stock" className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-2xl font-semibold text-amber-600">{lowItems.length}</p>
            <p className="text-sm text-zinc-500">Items low on stock</p>
          </Link>
          <Link href="/warehouse/inventory?view=expired" className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-2xl font-semibold text-zinc-700">{expiredBatches.length}</p>
            <p className="text-sm text-zinc-500">Expired batches</p>
          </Link>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {tabs.map((t) => (
              <Link key={t.k} href={`/warehouse/inventory?view=${t.k}`}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${active === t.k ? "bg-zinc-900 text-white" : "bg-white text-zinc-700 hover:bg-zinc-50"}`}>
                {t.label}
              </Link>
            ))}
          </div>
          <Link href="/warehouse" className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700">+ New GRN</Link>
        </div>

        <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
          {/* STOCK BALANCE */}
          {active === "stock" && (
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-zinc-50 text-left text-zinc-500">
                <tr><th className={th}>Raw Material</th><th className={th}>On Hand</th><th className={th}>Min Level (reorder)</th><th className={th}>Status</th></tr>
              </thead>
              <tbody>
                {itemRows.length === 0 ? <tr><td className={td} colSpan={4}>No items.</td></tr> :
                  itemRows.map((r) => (
                    <tr key={r.id} className={`border-t border-zinc-100 ${r.low ? "bg-amber-50" : ""}`}>
                      <td className={`${td} font-medium text-zinc-900`}>{r.name}</td>
                      <td className={td}>{r.onHand} {r.uom}</td>
                      <td className={td}><MinLevelInput itemId={r.id} current={r.min} /></td>
                      <td className={td}>{r.low ? <span className="rounded bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-900">LOW — reorder</span> : <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">OK</span>}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {/* BATCHES */}
          {active === "batches" && (
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-zinc-50 text-left text-zinc-500">
                <tr><th className={th}>Raw Material</th><th className={th}>Batch</th><th className={th}>Recd</th><th className={th}>Issued</th><th className={th}>Available</th><th className={th}>Expiry</th><th className={th}>GRN</th><th className={th}>Issue</th><th className={th}>Expired?</th></tr>
              </thead>
              <tbody>
                {batches.length === 0 ? <tr><td className={td} colSpan={9}>No items.</td></tr> :
                  batches.map((b) => {
                    const past = b.expiryDate && b.expiryDate < todayStr;
                    return (
                      <tr key={b.id} className={`border-t border-zinc-100 ${b.expired ? "bg-amber-50" : ""}`}>
                        <td className={`${td} font-medium text-zinc-900`}>{b.itemName}</td>
                        <td className={td}>{b.batchNo ?? "—"}</td>
                        <td className={td}>{b.received} {b.uom}</td>
                        <td className={td}>{b.issued}</td>
                        <td className={`${td} font-medium`}>{b.available} {b.uom}</td>
                        <td className={`${td} ${past ? "font-semibold text-red-600" : ""}`}>{b.expiryDate ?? "—"}</td>
                        <td className={`${td} font-mono text-xs`}>{b.grnRef}</td>
                        <td className={td}><IssueButton grnLineItemId={b.id} itemId={b.itemId} available={b.available} /></td>
                        <td className={td}><InventoryActions id={b.id} expired={b.expired} proofUrl={b.proofUrl} /></td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}

          {/* FEFO */}
          {active === "fefo" && (
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-zinc-50 text-left text-zinc-500">
                <tr><th className={th}>#</th><th className={th}>Raw Material</th><th className={th}>Batch</th><th className={th}>Available</th><th className={th}>Expiry</th><th className={th}>Days Left</th><th className={th}>Alert</th><th className={th}>Issue</th></tr>
              </thead>
              <tbody>
                {fefo.length === 0 ? <tr><td className={td} colSpan={8}>No available stock.</td></tr> :
                  fefo.map((b, i) => {
                    const dl = daysLeft(b.expiryDate);
                    // FEFO expiry alert windows
                    const alert =
                      dl === null ? null :
                      dl <= 0 ? { t: "EXPIRED", badge: "bg-zinc-800 text-white", row: "bg-zinc-100" } :
                      dl <= 30 ? { t: "EXPIRING SOON", badge: "bg-red-600 text-white", row: "bg-red-50" } :
                      dl <= 60 ? { t: "USE SOON", badge: "bg-amber-500 text-white", row: "bg-amber-50" } :
                      dl <= 90 ? { t: "≤ 90 days", badge: "bg-yellow-100 text-yellow-800", row: "" } :
                      null;
                    return (
                      <tr key={b.id} className={`border-t border-zinc-100 ${alert?.row ?? ""}`}>
                        <td className={`${td} text-zinc-400`}>{i + 1}</td>
                        <td className={`${td} font-medium text-zinc-900`}>{b.itemName}</td>
                        <td className={td}>{b.batchNo ?? "—"}</td>
                        <td className={`${td} font-medium`}>{b.available} {b.uom}</td>
                        <td className={td}>{b.expiryDate ?? "—"}</td>
                        <td className={`${td} ${dl !== null && dl <= 30 ? "font-semibold text-red-600" : ""}`}>{dl ?? "—"}</td>
                        <td className={td}>{alert ? <span className={`rounded px-2 py-0.5 text-xs font-semibold ${alert.badge}`}>{alert.t}</span> : "—"}</td>
                        <td className={td}><IssueButton grnLineItemId={b.id} itemId={b.itemId} available={b.available} /></td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}

          {/* EXPIRING SOON */}
          {active === "expiring" && (
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-zinc-50 text-left text-zinc-500">
                <tr><th className={th}>Raw Material</th><th className={th}>Batch</th><th className={th}>Available</th><th className={th}>Expiry</th><th className={th}>Days Left</th><th className={th}>Window</th></tr>
              </thead>
              <tbody>
                {expiringSoon.length === 0 ? <tr><td className={td} colSpan={6}>Nothing expiring within 90 days.</td></tr> :
                  expiringSoon.map((b) => {
                    const dl = daysLeft(b.expiryDate);
                    const win = b.expiryDate! <= d30 ? { t: "≤ 30 days", c: "bg-red-100 text-red-700" } : b.expiryDate! <= d60 ? { t: "≤ 60 days", c: "bg-amber-100 text-amber-700" } : { t: "≤ 90 days", c: "bg-yellow-100 text-yellow-700" };
                    return (
                      <tr key={b.id} className="border-t border-zinc-100">
                        <td className={`${td} font-medium text-zinc-900`}>{b.itemName}</td>
                        <td className={td}>{b.batchNo ?? "—"}</td>
                        <td className={td}>{b.available} {b.uom}</td>
                        <td className={td}>{b.expiryDate}</td>
                        <td className={td}>{dl}</td>
                        <td className={td}><span className={`rounded px-2 py-0.5 text-xs font-medium ${win.c}`}>{win.t}</span></td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}

          {/* EXPIRED */}
          {active === "expired" && (
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-zinc-50 text-left text-zinc-500">
                <tr><th className={th}>Raw Material</th><th className={th}>Batch</th><th className={th}>Qty</th><th className={th}>Expiry</th><th className={th}>GRN</th><th className={th}>Action</th></tr>
              </thead>
              <tbody>
                {expiredBatches.length === 0 ? <tr><td className={td} colSpan={6}>No expired items.</td></tr> :
                  expiredBatches.map((b) => (
                    <tr key={b.id} className="border-t border-zinc-100 bg-amber-50">
                      <td className={`${td} font-medium text-zinc-900`}>{b.itemName}</td>
                      <td className={td}>{b.batchNo ?? "—"}</td>
                      <td className={td}>{b.available} {b.uom}</td>
                      <td className={td}>{b.expiryDate ?? "—"}</td>
                      <td className={`${td} font-mono text-xs`}>{b.grnRef}</td>
                      <td className={td}><InventoryActions id={b.id} expired={b.expired} proofUrl={b.proofUrl} /></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
