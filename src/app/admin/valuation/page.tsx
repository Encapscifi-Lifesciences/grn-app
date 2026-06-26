import { requireRole, createServerSupabase } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { computeValuation, formatINR } from "@/lib/valuation";

export const dynamic = "force-dynamic";

export default async function ValuationPage() {
  // Admin-only: requireRole(["admin"]) lets only admins through (others redirect).
  const { user } = await requireRole(["admin"]);
  const supabase = await createServerSupabase();
  const v = await computeValuation(supabase);

  const th = "px-4 py-2.5 font-medium";
  const td = "px-4 py-2.5";
  const money = (n: number) => formatINR(n);

  const cards = [
    { label: "Inventory Value (Actual)", value: money(v.totals.actualValue), sub: "specific batch cost", color: "text-teal-700" },
    { label: "Inventory Value (WAC)", value: money(v.totals.wacValue), sub: "weighted avg cost", color: "text-emerald-700" },
    { label: "Good Stock Value", value: money(v.totals.goodValue), sub: "non-expired", color: "text-sky-700" },
    { label: "Expired (write-off)", value: money(v.totals.expiredValue), sub: "expired on hand", color: "text-amber-700" },
    { label: "Consumed / COGS", value: money(v.totals.consumedValue), sub: "value issued", color: "text-slate-700" },
  ];

  return (
    <div className="flex flex-1 flex-col app-bg">
      <AppHeader title="Inventory Valuation" email={user.email} back />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-5 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            Admin-only. Unit cost is taken from each PO line&apos;s rate. Values in ₹ (INR).
          </p>
          <div className="flex gap-2">
            <a href="/api/valuation?type=items" className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700">⬇ Item valuation CSV</a>
            <a href="/api/valuation?type=fefo" className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700">⬇ FEFO batches CSV</a>
          </div>
        </div>

        {v.missingCostBatches > 0 && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            ⚠️ {v.missingCostBatches} batch(es) in stock have no PO rate — they are valued at ₹0.
            Add a rate on the purchase order line for accurate valuation.
          </p>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {cards.map((c) => (
            <div key={c.label} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
              <p className="mt-0.5 text-xs font-medium text-slate-700">{c.label}</p>
              <p className="text-xs text-slate-400">{c.sub}</p>
            </div>
          ))}
        </div>

        {/* Value at risk */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { t: "Expiring ≤ 30 days", n: v.valueAtRisk.d30, c: "text-red-600" },
            { t: "Expiring ≤ 60 days", n: v.valueAtRisk.d60, c: "text-amber-600" },
            { t: "Expiring ≤ 90 days", n: v.valueAtRisk.d90, c: "text-yellow-600" },
          ].map((r) => (
            <div key={r.t} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <p className={`text-lg font-bold ${r.c}`}>{money(r.n)}</p>
              <p className="text-xs text-slate-500">Value at risk · {r.t}</p>
            </div>
          ))}
        </div>

        {/* Per-item valuation */}
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">
            📦 Valuation by Item
          </div>
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-100 text-left text-slate-500">
              <tr>
                <th className={th}>Raw Material</th>
                <th className={th}>On Hand</th>
                <th className={th}>WAC Unit Cost</th>
                <th className={th}>Actual Value</th>
                <th className={th}>WAC Value</th>
                <th className={th}>Diff</th>
              </tr>
            </thead>
            <tbody>
              {v.items.length === 0 ? (
                <tr><td className={td} colSpan={6}>No stock.</td></tr>
              ) : (
                v.items.map((i) => {
                  const diff = i.actualValue - i.wacValue;
                  return (
                    <tr key={i.itemId} className="border-t border-slate-100">
                      <td className={`${td} font-medium text-slate-900`}>
                        {i.itemName}
                        {i.hasMissingCost && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">no rate</span>}
                      </td>
                      <td className={td}>{i.onHand} {i.uom}</td>
                      <td className={td}>{money(i.wacUnit)}</td>
                      <td className={`${td} font-medium`}>{money(i.actualValue)}</td>
                      <td className={td}>{money(i.wacValue)}</td>
                      <td className={`${td} ${Math.abs(diff) > 0.005 ? "text-slate-600" : "text-slate-300"}`}>{money(diff)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {v.items.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-900">
                  <td className={td}>Total ({v.totals.itemsWithStock} items)</td>
                  <td className={td}></td>
                  <td className={td}></td>
                  <td className={td}>{money(v.totals.actualValue)}</td>
                  <td className={td}>{money(v.totals.wacValue)}</td>
                  <td className={td}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* FEFO costing */}
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">
            ⏱️ FEFO Costing — consumption order (earliest expiry first)
          </div>
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-slate-100 text-left text-slate-500">
              <tr>
                <th className={th}>#</th>
                <th className={th}>Raw Material</th>
                <th className={th}>Batch</th>
                <th className={th}>Available</th>
                <th className={th}>Unit Cost</th>
                <th className={th}>Value</th>
                <th className={th}>Expiry</th>
                <th className={th}>Days Left</th>
                <th className={th}>Cumulative</th>
              </tr>
            </thead>
            <tbody>
              {v.batchesFefo.length === 0 ? (
                <tr><td className={td} colSpan={9}>No available stock.</td></tr>
              ) : (
                (() => {
                  let cum = 0;
                  return v.batchesFefo.map((b, idx) => {
                    cum += b.availableValue;
                    const soon = b.daysLeft != null && b.daysLeft <= 30;
                    return (
                      <tr key={b.id} className={`border-t border-slate-100 ${b.expired ? "bg-amber-50" : soon ? "bg-red-50" : ""}`}>
                        <td className={`${td} text-slate-400`}>{idx + 1}</td>
                        <td className={`${td} font-medium text-slate-900`}>{b.itemName}</td>
                        <td className={td}>{b.batchNo ?? "—"}</td>
                        <td className={td}>{b.available} {b.uom}</td>
                        <td className={td}>{money(b.unitCost)}</td>
                        <td className={`${td} font-medium`}>{money(b.availableValue)}</td>
                        <td className={td}>{b.expiryDate ?? "—"}</td>
                        <td className={`${td} ${soon ? "font-semibold text-red-600" : ""}`}>{b.daysLeft ?? "—"}</td>
                        <td className={`${td} text-slate-500`}>{money(cum)}</td>
                      </tr>
                    );
                  });
                })()
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
