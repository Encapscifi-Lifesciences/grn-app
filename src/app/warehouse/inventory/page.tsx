/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { requireRole, createServerSupabase } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { InventoryActions } from "./InventoryActions";

export const dynamic = "force-dynamic";

const one = (x: any) => (Array.isArray(x) ? x[0] : x);

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { user } = await requireRole(["warehouse"]);
  const { view } = await searchParams;
  const supabase = await createServerSupabase();

  let q = supabase
    .from("grn_line_items")
    .select(
      "id, actual_qty, batch_no, expiry_date, expired, expiry_proof_url, " +
        "items(name), uoms(code), grns(grn_ref, warehouse_code, grn_date)"
    )
    .order("expiry_date", { ascending: true, nullsFirst: false });

  if (view === "expired") q = q.eq("expired", true);
  else if (view === "stock") q = q.eq("expired", false);

  const { data } = await q;
  const rows = (data ?? []) as any[];
  const today = new Date().toISOString().slice(0, 10);

  const tabs = [
    { k: "all", label: "All" },
    { k: "stock", label: "In Stock" },
    { k: "expired", label: "Expired" },
  ];
  const active = view ?? "all";

  return (
    <div className="flex flex-1 flex-col bg-zinc-100">
      <AppHeader title="Warehouse · Inventory" email={user.email} back />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            {tabs.map((t) => (
              <Link
                key={t.k}
                href={t.k === "all" ? "/warehouse/inventory" : `/warehouse/inventory?view=${t.k}`}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  active === t.k ? "bg-zinc-900 text-white" : "bg-white text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                {t.label}
              </Link>
            ))}
          </div>
          <Link href="/warehouse" className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700">
            + New GRN
          </Link>
        </div>

        <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
          {rows.length === 0 ? (
            <p className="p-6 text-sm text-zinc-500">No items found.</p>
          ) : (
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-zinc-50 text-left text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Raw Material</th>
                  <th className="px-4 py-3 font-medium">Qty</th>
                  <th className="px-4 py-3 font-medium">Batch</th>
                  <th className="px-4 py-3 font-medium">Expiry</th>
                  <th className="px-4 py-3 font-medium">GRN</th>
                  <th className="px-4 py-3 font-medium">WH</th>
                  <th className="px-4 py-3 font-medium">Received</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const grn = one(r.grns);
                  const pastExpiry = r.expiry_date && r.expiry_date < today;
                  return (
                    <tr key={r.id} className={`border-t border-zinc-100 ${r.expired ? "bg-amber-50" : ""}`}>
                      <td className="px-4 py-3 font-medium text-zinc-900">{one(r.items)?.name ?? "—"}</td>
                      <td className="px-4 py-3">{r.actual_qty} {one(r.uoms)?.code ?? ""}</td>
                      <td className="px-4 py-3">{r.batch_no ?? "—"}</td>
                      <td className={`px-4 py-3 ${pastExpiry ? "font-semibold text-red-600" : ""}`}>
                        {r.expiry_date ?? "—"}{pastExpiry && !r.expired ? " ⚠" : ""}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{grn?.grn_ref ?? "—"}</td>
                      <td className="px-4 py-3">{grn?.warehouse_code ?? "—"}</td>
                      <td className="px-4 py-3">{grn?.grn_date ?? "—"}</td>
                      <td className="px-4 py-3">
                        {r.expired ? (
                          <span className="rounded bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-900">EXPIRED</span>
                        ) : (
                          <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">In Stock</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <InventoryActions id={r.id} expired={r.expired} proofUrl={r.expiry_proof_url} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
