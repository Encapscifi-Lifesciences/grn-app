/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { requireRole, createServerSupabase } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { StatusControl } from "./StatusControl";
import { VoidControl } from "./VoidControl";

export const dynamic = "force-dynamic";

const one = (x: any) => (Array.isArray(x) ? x[0] : x);

const STATUS_STYLE: Record<string, string> = {
  pending_review: "bg-slate-200 text-slate-700",
  discrepancy: "bg-red-100 text-red-700",
  reconciled: "bg-emerald-100 text-emerald-700",
};

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; from?: string; to?: string }>;
}) {
  const { user } = await requireRole(["finance"]);
  const { status, q, from, to } = await searchParams;
  const supabase = await createServerSupabase();

  // Fetch all GRNs once (internal dataset is small) — enables counts + search.
  const { data } = await supabase
    .from("grns")
    .select(
      "id, grn_ref, warehouse_code, grn_date, status, voided, invoice_no, challan_no, attachment_url, purchase_orders(po_number, vendors(name)), grn_line_items(id)"
    )
    .order("created_at", { ascending: false });

  const all = (data ?? []) as any[];
  const vendorOf = (g: any) => one(one(g.purchase_orders)?.vendors)?.name ?? "";
  const poOf = (g: any) => one(g.purchase_orders)?.po_number ?? "";

  // Summary counts (ignore search/date filters, reflect whole dataset)
  const counts = {
    total: all.length,
    pending_review: all.filter((g) => !g.voided && g.status === "pending_review").length,
    discrepancy: all.filter((g) => !g.voided && g.status === "discrepancy").length,
    reconciled: all.filter((g) => !g.voided && g.status === "reconciled").length,
    voided: all.filter((g) => g.voided).length,
  };

  // Apply filters
  const active = status ?? "all";
  const term = (q ?? "").trim().toLowerCase();
  const grns = all.filter((g) => {
    if (active === "voided") {
      if (!g.voided) return false;
    } else if (active !== "all") {
      if (g.voided || g.status !== active) return false;
    }
    if (from && g.grn_date < from) return false;
    if (to && g.grn_date > to) return false;
    if (term) {
      const hay = [
        g.grn_ref,
        poOf(g),
        vendorOf(g),
        g.invoice_no,
        g.challan_no,
        g.warehouse_code,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(term)) return false;
    }
    return true;
  });

  const cards = [
    { k: "all", label: "Total GRNs", n: counts.total, color: "text-zinc-900" },
    { k: "pending_review", label: "Pending Review", n: counts.pending_review, color: "text-zinc-700" },
    { k: "discrepancy", label: "Discrepancy", n: counts.discrepancy, color: "text-red-600" },
    { k: "reconciled", label: "Reconciled", n: counts.reconciled, color: "text-green-600" },
    { k: "voided", label: "Voided", n: counts.voided, color: "text-amber-600" },
  ];

  const exportQs = new URLSearchParams();
  if (active !== "all") exportQs.set("status", active);
  if (from) exportQs.set("from", from);
  if (to) exportQs.set("to", to);
  if (term) exportQs.set("q", q!.trim());

  const inp =
    "rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-teal-600";

  return (
    <div className="flex flex-1 flex-col bg-slate-50">
      <AppHeader title="Finance · GRN Dashboard" email={user.email} back />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-4 p-4 sm:p-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {cards.map((c) => (
            <Link
              key={c.k}
              href={c.k === "all" ? "/finance" : `/finance?status=${c.k}`}
              className={`rounded-xl bg-white p-4 shadow-sm ring-1 transition-shadow hover:shadow-md ${
                active === c.k ? "ring-teal-600" : "ring-transparent"
              }`}
            >
              <p className={`text-2xl font-bold ${c.color}`}>{c.n}</p>
              <p className="text-xs text-zinc-500">{c.label}</p>
            </Link>
          ))}
        </div>

        {/* Search + date filters */}
        <form method="get" className="flex flex-wrap items-end gap-2 rounded-xl bg-white p-3 shadow-sm">
          {active !== "all" && <input type="hidden" name="status" value={active} />}
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium text-zinc-500">Search</label>
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="GRN ref, PO, vendor, invoice…"
              className={`${inp} w-full`}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500">From</label>
            <input type="date" name="from" defaultValue={from ?? ""} className={inp} />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500">To</label>
            <input type="date" name="to" defaultValue={to ?? ""} className={inp} />
          </div>
          <button type="submit" className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700">
            Apply
          </button>
          {(term || from || to) && (
            <Link
              href={active === "all" ? "/finance" : `/finance?status=${active}`}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-slate-50"
            >
              Clear
            </Link>
          )}
          <a
            href={`/api/export?${exportQs.toString()}`}
            className="ml-auto rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            ⬇ Export CSV
          </a>
        </form>

        <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
          {grns.length === 0 ? (
            <p className="p-6 text-sm text-zinc-500">No GRNs match your filters.</p>
          ) : (
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-slate-100 text-left text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">GRN Ref</th>
                  <th className="px-4 py-3 font-medium">WH</th>
                  <th className="px-4 py-3 font-medium">PO Number</th>
                  <th className="px-4 py-3 font-medium">Invoice No</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Items</th>
                  <th className="px-4 py-3 font-medium">Photo</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Set Status</th>
                  <th className="px-4 py-3 font-medium">Void</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {grns.map((g) => (
                  <tr
                    key={g.id}
                    className={`border-t border-zinc-100 ${g.voided ? "bg-slate-100 text-zinc-400" : ""}`}
                  >
                    <td className={`px-4 py-3 font-mono font-medium ${g.voided ? "line-through" : "text-zinc-900"}`}>
                      {g.grn_ref}
                    </td>
                    <td className="px-4 py-3">{g.warehouse_code}</td>
                    <td className="px-4 py-3">{poOf(g) || "—"}</td>
                    <td className="px-4 py-3">{g.invoice_no ?? "—"}</td>
                    <td className="px-4 py-3">{g.grn_date}</td>
                    <td className="px-4 py-3">{g.grn_line_items?.length ?? 0}</td>
                    <td className="px-4 py-3">
                      {g.attachment_url ? (
                        <a href={g.attachment_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">view</a>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {g.voided ? (
                        <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">voided</span>
                      ) : (
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[g.status] ?? ""}`}>
                          {g.status.replace("_", " ")}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {g.voided ? <span className="text-xs text-zinc-400">—</span> : <StatusControl grnId={g.id} current={g.status} />}
                    </td>
                    <td className="px-4 py-3">
                      <VoidControl grnId={g.id} voided={g.voided} />
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/finance/${g.id}`} className="text-blue-600 underline">details</Link>
                    </td>
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
