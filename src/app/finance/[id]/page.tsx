/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole, createServerSupabase } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { VoidControl } from "../VoidControl";
import { PrintButton } from "./PrintButton";

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

  const [{ data: grn }, { data: auditData }] = await Promise.all([
    supabase
      .from("grns")
      .select(
        "*, purchase_orders(po_number, vendors(name)), grn_line_items(*, items(name), uoms(code))"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("grn_audit_log")
      .select("action, detail, actor_email, created_at")
      .eq("grn_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!grn) notFound();
  const g = grn as any;
  const po = one(g.purchase_orders);
  const vendor = one(po?.vendors)?.name ?? "—";
  const lines = g.grn_line_items ?? [];
  const audit = (auditData ?? []) as any[];

  return (
    <div className="flex flex-1 flex-col bg-slate-50 print:bg-white">
      <div className="no-print">
        <AppHeader title={`GRN ${g.grn_ref}`} email={user.email} back />
      </div>
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 p-4 sm:p-6 print:p-0">
        <div className="no-print flex items-center justify-between">
          <Link href="/finance" className="text-sm text-blue-600 underline">← Back to dashboard</Link>
          <div className="flex items-center gap-2">
            <PrintButton />
            <VoidControl grnId={g.id} voided={g.voided} />
          </div>
        </div>

        {/* Print-only header */}
        <div className="hidden print:block">
          <h1 className="text-xl font-bold">Encapscifi — Goods Received Note</h1>
          <p className="font-mono text-sm">{g.grn_ref}</p>
          <hr className="my-2" />
        </div>

        {g.voided && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
            ⚠️ <span className="font-semibold">This GRN is VOIDED.</span>{" "}
            {g.void_reason ? <>Reason: {g.void_reason}</> : null}
          </div>
        )}

        <div className="grid gap-3 rounded-xl bg-white p-5 text-sm shadow-sm sm:grid-cols-2 print:shadow-none print:ring-1 print:ring-zinc-300">
          <div><span className="text-zinc-500">GRN Ref:</span> <span className="font-mono font-medium">{g.grn_ref}</span></div>
          <div><span className="text-zinc-500">Status:</span> <span className="font-medium">{g.voided ? "voided" : g.status.replace("_", " ")}</span></div>
          <div><span className="text-zinc-500">Warehouse:</span> {g.warehouse_code}</div>
          <div><span className="text-zinc-500">Date:</span> {g.grn_date}</div>
          <div><span className="text-zinc-500">PO Number:</span> {po?.po_number ?? "—"}</div>
          <div><span className="text-zinc-500">Vendor:</span> {vendor}</div>
          <div><span className="text-zinc-500">Invoice No:</span> {g.invoice_no ?? "—"}</div>
          <div><span className="text-zinc-500">Challan No:</span> {g.challan_no ?? "—"}</div>
        </div>

        {g.attachment_url && (
          <div className="rounded-xl bg-white p-5 shadow-sm no-print">
            <p className="mb-2 text-sm font-medium text-zinc-700">Delivery Challan / Damage Photo</p>
            <a href={g.attachment_url} target="_blank" rel="noopener noreferrer">
              <img src={g.attachment_url} alt="challan" className="max-h-64 rounded-lg border border-zinc-200" />
            </a>
          </div>
        )}

        <div className="overflow-x-auto rounded-xl bg-white shadow-sm print:shadow-none print:ring-1 print:ring-zinc-300">
          <table className="w-full min-w-[760px] text-sm print:min-w-0">
            <thead className="bg-slate-100 text-left text-zinc-500">
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
                <th className="px-3 py-2 font-medium no-print">Proof</th>
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
                    <td className="px-3 py-2 no-print">
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

        {/* Audit log */}
        <div className="rounded-xl bg-white p-5 shadow-sm print:shadow-none">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900">📋 Audit Trail</h2>
          {audit.length === 0 ? (
            <p className="text-sm text-zinc-500">No status changes recorded yet.</p>
          ) : (
            <ol className="space-y-2 text-sm">
              {audit.map((a, i) => (
                <li key={i} className="flex flex-wrap gap-x-2 border-l-2 border-zinc-200 pl-3">
                  <span className="font-medium text-zinc-800">{a.detail}</span>
                  <span className="text-zinc-400">·</span>
                  <span className="text-zinc-500">{a.actor_email ?? "system"}</span>
                  <span className="text-zinc-400">·</span>
                  <span className="text-zinc-500">{new Date(a.created_at).toLocaleString()}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Print-only signature block */}
        <div className="hidden grid-cols-3 gap-8 pt-12 text-sm print:grid">
          <div className="border-t border-zinc-400 pt-1 text-center">Received By</div>
          <div className="border-t border-zinc-400 pt-1 text-center">Checked By</div>
          <div className="border-t border-zinc-400 pt-1 text-center">Authorized By</div>
        </div>
      </main>
    </div>
  );
}
