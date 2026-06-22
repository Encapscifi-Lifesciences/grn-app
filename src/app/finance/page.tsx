/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { requireRole, createServerSupabase } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { StatusControl } from "./StatusControl";

export const dynamic = "force-dynamic";

const one = (x: any) => (Array.isArray(x) ? x[0] : x);

const STATUS_STYLE: Record<string, string> = {
  pending_review: "bg-zinc-100 text-zinc-700",
  discrepancy: "bg-red-100 text-red-700",
  reconciled: "bg-green-100 text-green-700",
};

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { user } = await requireRole(["finance"]);
  const { status } = await searchParams;
  const supabase = await createServerSupabase();

  let q = supabase
    .from("grns")
    .select(
      "id, grn_ref, warehouse_code, grn_date, status, invoice_no, attachment_url, purchase_orders(po_number), grn_line_items(id)"
    )
    .order("created_at", { ascending: false });
  if (status && status !== "all") q = q.eq("status", status as any);

  const { data } = await q;
  const grns = (data ?? []) as any[];

  const filters = [
    { k: "all", label: "All" },
    { k: "pending_review", label: "Pending Review" },
    { k: "discrepancy", label: "Discrepancy" },
    { k: "reconciled", label: "Reconciled" },
  ];
  const active = status ?? "all";

  return (
    <div className="flex flex-1 flex-col bg-zinc-100">
      <AppHeader title="Finance · GRN Dashboard" email={user.email} back />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {filters.map((f) => (
              <Link
                key={f.k}
                href={f.k === "all" ? "/finance" : `/finance?status=${f.k}`}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  active === f.k ? "bg-zinc-900 text-white" : "bg-white text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                {f.label}
              </Link>
            ))}
          </div>
          <a
            href={`/api/export?status=${active}`}
            className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
          >
            ⬇ Export Data (CSV)
          </a>
        </div>

        <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
          {grns.length === 0 ? (
            <p className="p-6 text-sm text-zinc-500">No GRNs found.</p>
          ) : (
            <table className="w-full min-w-[800px] text-sm">
              <thead className="bg-zinc-50 text-left text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">GRN Ref</th>
                  <th className="px-4 py-3 font-medium">WH</th>
                  <th className="px-4 py-3 font-medium">PO Number</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Items</th>
                  <th className="px-4 py-3 font-medium">Photo</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Set Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {grns.map((g) => (
                  <tr key={g.id} className="border-t border-zinc-100">
                    <td className="px-4 py-3 font-mono font-medium text-zinc-900">{g.grn_ref}</td>
                    <td className="px-4 py-3">{g.warehouse_code}</td>
                    <td className="px-4 py-3">{one(g.purchase_orders)?.po_number ?? "—"}</td>
                    <td className="px-4 py-3">{g.grn_date}</td>
                    <td className="px-4 py-3">{g.grn_line_items?.length ?? 0}</td>
                    <td className="px-4 py-3">
                      {g.attachment_url ? (
                        <a href={g.attachment_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">view</a>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[g.status] ?? ""}`}>
                        {g.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3"><StatusControl grnId={g.id} current={g.status} /></td>
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
