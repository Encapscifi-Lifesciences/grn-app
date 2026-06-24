/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole, createServerSupabase } from "@/lib/supabase/server";
import { COMPANY, WAREHOUSES } from "@/lib/company";
import { DownloadButton } from "./DownloadButton";

export const dynamic = "force-dynamic";

const one = (x: any) => (Array.isArray(x) ? x[0] : x);

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
});

const STATUS_LABEL: Record<string, string> = {
  pending_review: "Pending Review",
  discrepancy: "Discrepancy",
  reconciled: "Reconciled",
};

export default async function GRNDocument({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Warehouse (creator), Finance, and Admin may view/print a GRN note.
  await requireRole(["warehouse", "finance"]);
  const { id } = await params;
  const supabase = await createServerSupabase();

  const { data: grn } = await supabase
    .from("grns")
    .select(
      "*, purchase_orders(po_number, po_date, vendors(name)), " +
        "grn_line_items(*, items(name), uoms(code), po_line_items(rate))"
    )
    .eq("id", id)
    .maybeSingle();

  if (!grn) notFound();
  const g = grn as any;
  const po = one(g.purchase_orders);
  const vendor = one(po?.vendors)?.name ?? "—";
  const lines: any[] = g.grn_line_items ?? [];

  // Value totals (received qty × PO rate), shown only when rates are present.
  const valued = lines.map((li) => {
    const rate = Number(one(li.po_line_items)?.rate ?? 0);
    const amount = rate * Number(li.actual_qty ?? 0);
    return { ...li, rate, amount };
  });
  const hasValue = valued.some((li) => li.rate > 0);
  const total = valued.reduce((s, li) => s + li.amount, 0);

  const statusLabel = g.voided
    ? "Voided"
    : STATUS_LABEL[g.status] ?? g.status;

  return (
    <div className="min-h-screen bg-zinc-100 py-6 print:bg-white print:py-0">
      {/* Toolbar (screen only) */}
      <div className="no-print mx-auto mb-4 flex max-w-3xl items-center justify-between px-4">
        <Link href="/finance" className="text-sm text-teal-700 underline">
          ← Back
        </Link>
        <DownloadButton />
      </div>

      {/* The A4 document */}
      <div className="mx-auto max-w-3xl bg-white text-zinc-800 shadow-sm print:max-w-none print:shadow-none">
        {/* Header band */}
        <header className="flex items-start justify-between gap-4 bg-zinc-50 px-10 py-7 print:bg-zinc-50">
          <div className="flex items-center gap-3">
            <svg viewBox="0 0 100 100" className="h-12 w-12" aria-hidden>
              <polygon
                points="50,4 91,27 91,73 50,96 9,73 9,27"
                fill="none"
                stroke="#0f172a"
                strokeWidth="7"
              />
              <polygon points="50,30 70,42 70,64 50,76 30,64 30,42" fill="#0f172a" />
            </svg>
            <div className="leading-tight">
              <div className="text-sm font-bold tracking-tight text-zinc-900">
                Encapscifi
              </div>
              <div className="text-xs text-zinc-500">Lifesciences</div>
            </div>
          </div>
          <div className="text-right text-[11px] leading-snug text-zinc-600">
            <div className="font-semibold text-zinc-900">{COMPANY.name}</div>
            {COMPANY.addressLines.map((l) => (
              <div key={l}>{l}</div>
            ))}
          </div>
        </header>

        <div className="px-10 py-7">
          {/* Address blocks */}
          <div className="grid grid-cols-2 gap-8 text-[11px] leading-relaxed">
            <div>
              <div className="font-semibold text-zinc-900">Received at:</div>
              <div>{WAREHOUSES[g.warehouse_code] ?? g.warehouse_code}</div>
              {COMPANY.addressLines.map((l) => (
                <div key={l}>{l}</div>
              ))}
              <div>📞 {COMPANY.phone}</div>
            </div>
            <div>
              <div className="font-semibold text-zinc-900">Supplier / Vendor:</div>
              <div className="text-sm font-medium text-zinc-900">{vendor}</div>
            </div>
          </div>

          {/* Title */}
          <h1 className="mt-7 text-3xl font-light text-zinc-400">
            Goods Received Note{" "}
            <span className="text-zinc-700">#{g.grn_ref}</span>
          </h1>

          {g.voided && (
            <div className="mt-3 inline-block rounded border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
              ⚠ THIS GRN IS VOIDED{g.void_reason ? ` — ${g.void_reason}` : ""}
            </div>
          )}

          {/* Info band */}
          <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-3 rounded bg-zinc-50 px-5 py-4 text-[11px] sm:grid-cols-4 print:bg-zinc-50">
            <Field label="PO Number" value={po?.po_number ?? "—"} />
            <Field label="GRN Date" value={g.grn_date ?? "—"} />
            <Field label="Status" value={statusLabel} />
            <Field label="Warehouse" value={g.warehouse_code ?? "—"} />
            <Field label="Invoice No." value={g.invoice_no ?? "—"} />
            <Field label="Challan No." value={g.challan_no ?? "—"} />
            <Field label="PO Date" value={po?.po_date ?? "—"} />
          </div>

          {/* Line items */}
          <table className="mt-6 w-full border-collapse text-[11px]">
            <thead>
              <tr className="border-b-2 border-zinc-300 text-left text-zinc-600">
                <th className="py-2 pr-2 font-semibold">Description</th>
                <th className="py-2 px-2 text-right font-semibold">Ordered</th>
                <th className="py-2 px-2 text-right font-semibold">Received</th>
                <th className="py-2 px-2 font-semibold">UOM</th>
                <th className="py-2 px-2 font-semibold">Batch / Lot</th>
                <th className="py-2 px-2 font-semibold">Mfg</th>
                <th className="py-2 px-2 font-semibold">Expiry</th>
                {hasValue && (
                  <>
                    <th className="py-2 px-2 text-right font-semibold">Unit Price</th>
                    <th className="py-2 pl-2 text-right font-semibold">Amount</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {valued.map((li) => {
                const mismatch =
                  Number(li.actual_qty) !== Number(li.expected_qty);
                return (
                  <tr key={li.id} className="border-b border-zinc-200 align-top">
                    <td className="py-2 pr-2 font-medium text-zinc-900">
                      {one(li.items)?.name ?? "—"}
                      {li.damaged_qty > 0 && (
                        <div className="text-[10px] font-normal text-red-600">
                          ⚠ {li.damaged_qty} damaged
                          {li.damage_reason ? ` — ${li.damage_reason}` : ""}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-2 text-right">{li.expected_qty}</td>
                    <td
                      className={`py-2 px-2 text-right ${
                        mismatch ? "font-bold text-red-600" : ""
                      }`}
                    >
                      {li.actual_qty}
                    </td>
                    <td className="py-2 px-2">{one(li.uoms)?.code ?? ""}</td>
                    <td className="py-2 px-2">{li.batch_no ?? "—"}</td>
                    <td className="py-2 px-2">{li.mfg_date ?? "—"}</td>
                    <td className="py-2 px-2">
                      {li.expiry_date ?? "—"}
                      {li.expired && (
                        <span className="ml-1 font-semibold text-amber-700">
                          (expired)
                        </span>
                      )}
                    </td>
                    {hasValue && (
                      <>
                        <td className="py-2 px-2 text-right">
                          {li.rate ? li.rate.toFixed(4) : "—"}
                        </td>
                        <td className="py-2 pl-2 text-right">
                          {li.rate ? inr.format(li.amount) : "—"}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
            {hasValue && (
              <tfoot>
                <tr>
                  <td
                    colSpan={8}
                    className="py-3 pr-2 text-right text-xs font-semibold text-zinc-700"
                  >
                    Total Received Value (excl. tax)
                  </td>
                  <td className="py-3 pl-2 text-right text-xs font-bold text-zinc-900">
                    {inr.format(total)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>

          {/* Signatures */}
          <div className="mt-16 grid grid-cols-3 gap-10 text-[11px]">
            {["Received By", "Checked By", "Authorized By"].map((s) => (
              <div key={s} className="border-t border-zinc-400 pt-1 text-center text-zinc-600">
                {s}
              </div>
            ))}
          </div>
        </div>

        {/* Footer band */}
        <footer className="mt-6 border-t border-zinc-200 px-10 py-4 text-center text-[10px] text-zinc-500">
          <div>
            Phone: {COMPANY.phone} &nbsp; Email: {COMPANY.email} &nbsp; Website:{" "}
            {COMPANY.website}
          </div>
          <div className="mt-1">GSTIN : {COMPANY.gstin}</div>
        </footer>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-zinc-500">{label}</div>
      <div className="font-medium text-zinc-900">{value}</div>
    </div>
  );
}
