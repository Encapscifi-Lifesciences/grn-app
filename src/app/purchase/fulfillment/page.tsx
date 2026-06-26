/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireRole, createServerSupabase } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";

export const dynamic = "force-dynamic";

const one = (x: any) => (Array.isArray(x) ? x[0] : x);
const EPS = 0.0005;

type LineStatus = "open" | "partial" | "fulfilled" | "over";

const LINE_BADGE: Record<LineStatus, string> = {
  open: "bg-slate-200 text-slate-700",
  partial: "bg-amber-100 text-amber-700",
  fulfilled: "bg-emerald-100 text-emerald-700",
  over: "bg-red-100 text-red-700",
};
const LINE_LABEL: Record<LineStatus, string> = {
  open: "Open",
  partial: "Partial",
  fulfilled: "Fulfilled",
  over: "Over-received",
};

function lineStatus(expected: number, received: number): LineStatus {
  if (received > expected + EPS) return "over";
  if (received <= EPS) return "open";
  if (received < expected - EPS) return "partial";
  return "fulfilled";
}

// PO fulfillment: expected vs received quantity per PO line across all GRNs.
// Flags partial deliveries and over-receipts.
export default async function FulfillmentPage() {
  const { user } = await requireRole(["purchase", "finance"]);
  const supabase = await createServerSupabase();

  const [poRes, liRes] = await Promise.all([
    supabase
      .from("purchase_orders")
      .select(
        "id, po_number, po_date, cancelled, vendors(name), " +
          "po_line_items(id, expected_qty, items(name), uoms(code))"
      )
      .order("po_date", { ascending: false }),
    supabase.from("grn_line_items").select("po_line_item_id, actual_qty"),
  ]);

  const pos = (poRes.data ?? []) as any[];
  const lineItems = (liRes.data ?? []) as any[];

  // received qty per po_line_item
  const receivedByPoLine = new Map<string, number>();
  for (const li of lineItems) {
    if (!li.po_line_item_id) continue;
    receivedByPoLine.set(
      li.po_line_item_id,
      (receivedByPoLine.get(li.po_line_item_id) ?? 0) + (Number(li.actual_qty) || 0)
    );
  }

  const orders = pos
    .filter((p) => !p.cancelled)
    .map((p) => {
      const lines = (p.po_line_items ?? []).map((l: any) => {
        const expected = Number(l.expected_qty) || 0;
        const received = receivedByPoLine.get(l.id) ?? 0;
        return {
          id: l.id,
          itemName: one(l.items)?.name ?? "—",
          uom: one(l.uoms)?.code ?? "",
          expected,
          received,
          remaining: Math.max(expected - received, 0),
          status: lineStatus(expected, received),
        };
      });
      // PO-level rollup: worst-case wins
      const statuses = lines.map((l: any) => l.status);
      const poStatus: LineStatus = statuses.includes("over")
        ? "over"
        : statuses.every((s: LineStatus) => s === "fulfilled") && statuses.length > 0
          ? "fulfilled"
          : statuses.every((s: LineStatus) => s === "open")
            ? "open"
            : "partial";
      return {
        id: p.id,
        poNumber: p.po_number,
        poDate: p.po_date,
        vendor: one(p.vendors)?.name ?? "—",
        lines,
        status: poStatus,
      };
    });

  const counts = {
    open: orders.filter((o) => o.status === "open").length,
    partial: orders.filter((o) => o.status === "partial").length,
    fulfilled: orders.filter((o) => o.status === "fulfilled").length,
    over: orders.filter((o) => o.status === "over").length,
  };

  const cards = [
    { label: "Open", n: counts.open, color: "text-slate-700" },
    { label: "Partial", n: counts.partial, color: "text-amber-600" },
    { label: "Fulfilled", n: counts.fulfilled, color: "text-emerald-600" },
    { label: "Over-received", n: counts.over, color: "text-red-600" },
  ];

  return (
    <div className="flex flex-1 flex-col app-bg">
      <AppHeader title="PO Fulfillment" email={user.email} back />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {cards.map((c) => (
            <div key={c.label} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
              <p className={`text-2xl font-bold ${c.color}`}>{c.n}</p>
              <p className="text-xs font-medium text-slate-500">{c.label}</p>
            </div>
          ))}
        </div>

        {orders.length === 0 ? (
          <div className="card p-8 text-center text-sm text-slate-500">No active purchase orders.</div>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => (
              <div key={o.id} className="card p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <span className="font-mono font-semibold text-slate-900">{o.poNumber}</span>
                    <span className="ml-2 text-xs text-slate-500">{o.vendor} · {o.poDate}</span>
                  </div>
                  <span className={`badge ${LINE_BADGE[o.status]}`}>{LINE_LABEL[o.status]}</span>
                </div>
                <table className="mt-3 w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="py-1.5 font-medium">Raw Material</th>
                      <th className="py-1.5 font-medium">Ordered</th>
                      <th className="py-1.5 font-medium">Received</th>
                      <th className="py-1.5 font-medium">Remaining</th>
                      <th className="py-1.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {o.lines.map((l: any) => (
                      <tr key={l.id} className="border-t border-slate-100">
                        <td className="py-1.5 font-medium text-slate-800">{l.itemName}</td>
                        <td className="py-1.5">{l.expected} {l.uom}</td>
                        <td className="py-1.5">{l.received} {l.uom}</td>
                        <td className={`py-1.5 ${l.status === "over" ? "text-red-600" : ""}`}>
                          {l.status === "over"
                            ? `+${(l.received - l.expected).toFixed(3).replace(/\.?0+$/, "")} over`
                            : `${l.remaining} ${l.uom}`}
                        </td>
                        <td className="py-1.5">
                          <span className={`badge ${LINE_BADGE[l.status as LineStatus]}`}>
                            {LINE_LABEL[l.status as LineStatus]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
