/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole, createServerSupabase } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";

export const dynamic = "force-dynamic";

const one = (x: any) => (Array.isArray(x) ? x[0] : x);

export default async function GRNDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await requireRole(["finance"]);
  const { id } = await params;
  const supabase = await createServerSupabase();

  const { data: grn } = await supabase
    .from("grns")
    .select(
      "*, purchase_orders(po_number, vendors(name)), grn_line_items(*, items(name), uoms(code))"
    )
    .eq("id", id)
    .maybeSingle();

  if (!grn) notFound();
  const g = grn as any;
  const po = one(g.purchase_orders);
  const vendor = one(po?.vendors)?.name ?? "—";
  const lines = g.grn_line_items ?? [];

  return (
    <div className="flex flex-1 flex-col bg-zinc-100">
      <AppHeader title={`GRN ${g.grn_ref}`} email={user.email} back />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 p-4 sm:p-6">
        <Link href="/finance" className="text-sm text-blue-600 underline">← Back to dashboard</Link>

        <div className="grid gap-3 rounded-xl bg-white p-5 text-sm shadow-sm sm:grid-cols-2">
          <div><span className="text-zinc-500">GRN Ref:</span> <span className="font-mono font-medium">{g.grn_ref}</span></div>
          <div><span className="text-zinc-500">Status:</span> <span className="font-medium">{g.status.replace("_", " ")}</span></div>
          <div><span className="text-zinc-500">Warehouse:</span> {g.warehouse_code}</div>
          <div><span className="text-zinc-500">Date:</span> {g.grn_date}</div>
          <div><span className="text-zinc-500">PO Number:</span> {po?.po_number ?? "—"}</div>
          <div><span className="text-zinc-500">Vendor:</span> {vendor}</div>
          <div><span className="text-zinc-500">Invoice No:</span> {g.invoice_no ?? "—"}</div>
          <div><span className="text-zinc-500">Challan No:</span> {g.challan_no ?? "—"}</div>
        </div>

        {g.attachment_url && (
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="mb-2 text-sm font-medium text-zinc-700">Delivery Challan / Damage Photo</p>
            <a href={g.attachment_url} target="_blank" rel="noopener noreferrer">
              <img src={g.attachment_url} alt="challan" className="max-h-64 rounded-lg border border-zinc-200" />
            </a>
          </div>
        )}

        <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-zinc-50 text-left text-zinc-500">
              <tr>
                <th className="px-3 py-2 font-medium">Item</th>
                <th className="px-3 py-2 font-medium">Expected</th>
                <th className="px-3 py-2 font-medium">Actual</th>
                <th className="px-3 py-2 font-medium">UOM</th>
                <th className="px-3 py-2 font-medium">Batch</th>
                <th className="px-3 py-2 font-medium">Mfg</th>
                <th className="px-3 py-2 font-medium">Expiry</th>
                <th className="px-3 py-2 font-medium">Expired</th>
                <th className="px-3 py-2 font-medium">Damaged</th>
                <th className="px-3 py-2 font-medium">Proof</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((li: any) => {
                const mismatch = Number(li.actual_qty) !== Number(li.expected_qty);
                return (
                  <tr key={li.id} className="border-t border-zinc-100">
                    <td className="px-3 py-2 font-medium text-zinc-900">{one(li.items)?.name ?? "—"}</td>
                    <td className="px-3 py-2">{li.expected_qty}</td>
                    <td className={`px-3 py-2 ${mismatch ? "font-semibold text-red-600" : ""}`}>{li.actual_qty}</td>
                    <td className="px-3 py-2">{one(li.uoms)?.code ?? ""}</td>
                    <td className="px-3 py-2">{li.batch_no ?? "—"}</td>
                    <td className="px-3 py-2">{li.mfg_date ?? "—"}</td>
                    <td className="px-3 py-2">{li.expiry_date ?? "—"}</td>
                    <td className="px-3 py-2">{li.expired ? <span className="font-semibold text-amber-700">YES</span> : "No"}</td>
                    <td className="px-3 py-2">{li.damaged_qty > 0 ? `${li.damaged_qty} (${li.damage_reason ?? ""})` : "—"}</td>
                    <td className="px-3 py-2">
                      {li.expiry_proof_url ? (
                        <a href={li.expiry_proof_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">view</a>
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
