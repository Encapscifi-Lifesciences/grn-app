/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { requireRole, createServerSupabase } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { daysToExpiry, expiryLevel, EXPIRY_BADGE, todayUtc } from "@/lib/expiry";

export const dynamic = "force-dynamic";

const one = (x: any) => (Array.isArray(x) ? x[0] : x);

// Batch / lot traceability — recall readiness. For a given batch (or item / GRN /
// vendor), show where it was received and everywhere it was issued.
export default async function TracePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { user } = await requireRole(["warehouse", "finance"]);
  const { q } = await searchParams;
  const term = (q ?? "").trim().toLowerCase();
  const supabase = await createServerSupabase();

  const [liRes, issRes] = await Promise.all([
    supabase
      .from("grn_line_items")
      .select(
        "id, batch_no, actual_qty, damaged_qty, mfg_date, expiry_date, expired, " +
          "items(name), uoms(code), " +
          "grns(grn_ref, grn_date, warehouse_code, purchase_orders(po_number, vendors(name)))"
      ),
    supabase
      .from("stock_issues")
      .select("grn_line_item_id, qty, note, created_at")
      .order("created_at", { ascending: true }),
  ]);

  const lineItems = (liRes.data ?? []) as any[];
  const issues = (issRes.data ?? []) as any[];

  const issuesByLine = new Map<string, any[]>();
  for (const s of issues) {
    const arr = issuesByLine.get(s.grn_line_item_id) ?? [];
    arr.push(s);
    issuesByLine.set(s.grn_line_item_id, arr);
  }

  const today = todayUtc();
  const rows = lineItems.map((l) => {
    const lineIssues = issuesByLine.get(l.id) ?? [];
    const issued = lineIssues.reduce((a: number, s: any) => a + Number(s.qty), 0);
    const received = Number(l.actual_qty) || 0;
    const grn = one(l.grns);
    const po = one(grn?.purchase_orders);
    return {
      id: l.id,
      batchNo: (l.batch_no as string) || null,
      itemName: one(l.items)?.name ?? "—",
      uom: one(l.uoms)?.code ?? "",
      received,
      issued,
      available: Math.max(received - issued, 0),
      damaged: Number(l.damaged_qty) || 0,
      mfgDate: l.mfg_date as string | null,
      expiryDate: l.expiry_date as string | null,
      expired: l.expired as boolean,
      grnRef: grn?.grn_ref ?? "—",
      grnDate: grn?.grn_date ?? "",
      warehouse: grn?.warehouse_code ?? "",
      poNumber: po?.po_number ?? "",
      vendor: one(po?.vendors)?.name ?? "",
      issues: lineIssues,
    };
  });

  const filtered = (
    term
      ? rows.filter((r) =>
          [r.batchNo, r.itemName, r.grnRef, r.poNumber, r.vendor]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(term)
        )
      : rows
  ).sort((a, b) => {
    // group by item, then batch, newest receipt first
    if (a.itemName !== b.itemName) return a.itemName.localeCompare(b.itemName);
    return String(b.grnDate).localeCompare(String(a.grnDate));
  });

  return (
    <div className="flex flex-1 flex-col app-bg">
      <AppHeader title="Batch Traceability" email={user.email} back />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 p-4 sm:p-6">
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-900">🔎 Trace a batch / lot</h2>
          <p className="mt-1 text-xs text-slate-500">
            Search by batch number, raw material, GRN reference, PO or vendor to see where stock
            was received and everywhere it was consumed — recall readiness in one place.
          </p>
          <form method="get" className="mt-3 flex flex-wrap items-end gap-2">
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="e.g. batch BX-2207, or 'DFG'…"
              className="field max-w-md flex-1"
            />
            <button type="submit" className="btn-primary">Trace</button>
            {term && (
              <Link href="/trace" className="btn-secondary">Clear</Link>
            )}
          </form>
        </div>

        {filtered.length === 0 ? (
          <div className="card p-8 text-center text-sm text-slate-500">
            {term ? "No batches match your search." : "No received stock to trace yet."}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((r) => {
              const dl = daysToExpiry(r.expiryDate, today);
              const badge = EXPIRY_BADGE[expiryLevel(dl)];
              return (
                <div key={r.id} className="card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{r.itemName}</span>
                        <span className="badge bg-slate-100 font-mono text-slate-700">
                          {r.batchNo ?? "no batch"}
                        </span>
                        {r.expired && <span className="badge bg-zinc-800 text-white">EXPIRED</span>}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Received on{" "}
                        <Link href={`/finance`} className="link-teal">{r.grnRef}</Link>{" "}
                        · {r.grnDate} · {r.warehouse}
                        {r.poNumber ? ` · PO ${r.poNumber}` : ""}
                        {r.vendor ? ` · ${r.vendor}` : ""}
                      </p>
                    </div>
                    {badge && (
                      <span className={`badge ${badge.cls}`}>
                        {badge.text}
                        {dl !== null && dl >= 0 ? ` (${dl}d)` : ""}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-lg bg-slate-50 py-2">
                      <p className="text-lg font-semibold text-slate-900">{r.received} {r.uom}</p>
                      <p className="text-xs text-slate-500">Received</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 py-2">
                      <p className="text-lg font-semibold text-amber-600">{r.issued} {r.uom}</p>
                      <p className="text-xs text-slate-500">Issued / used</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 py-2">
                      <p className="text-lg font-semibold text-teal-700">{r.available} {r.uom}</p>
                      <p className="text-xs text-slate-500">On hand</p>
                    </div>
                  </div>

                  <div className="mt-3">
                    <p className="section-title mb-1">Movements</p>
                    {r.issues.length === 0 ? (
                      <p className="text-xs text-slate-400">No issues recorded — full quantity still on hand.</p>
                    ) : (
                      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
                        {r.issues.map((s: any, i: number) => (
                          <li key={i} className="flex items-center justify-between px-3 py-1.5 text-xs">
                            <span className="text-slate-600">
                              {String(s.created_at).slice(0, 10)}
                              {s.note ? ` · ${s.note}` : ""}
                            </span>
                            <span className="font-medium text-amber-700">− {Number(s.qty)} {r.uom}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
