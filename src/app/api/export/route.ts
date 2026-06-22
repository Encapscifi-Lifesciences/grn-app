/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerSupabase, getSessionRole } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const one = (x: any) => (Array.isArray(x) ? x[0] : x);

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// CSV export of GRN line items, optionally filtered by status. Odoo-friendly.
export async function GET(request: Request) {
  const { user, role } = await getSessionRole();
  if (!user || (role !== "finance" && role !== "admin")) {
    return new Response("Forbidden", { status: 403 });
  }

  const status = new URL(request.url).searchParams.get("status");
  const supabase = await createServerSupabase();

  let q = supabase
    .from("grns")
    .select(
      "grn_ref, warehouse_code, grn_date, status, invoice_no, challan_no, " +
        "purchase_orders(po_number, vendors(name)), " +
        "grn_line_items(expected_qty, actual_qty, batch_no, mfg_date, expiry_date, expired, damaged_qty, damage_reason, items(name), uoms(code))"
    )
    .order("created_at", { ascending: false });

  if (status && status !== "all") q = q.eq("status", status as any);

  const { data, error } = await q;
  if (error) return new Response(`Error: ${error.message}`, { status: 500 });

  const header = [
    "GRN Ref", "Warehouse", "GRN Date", "Status", "PO Number", "Vendor",
    "Invoice No", "Challan No", "Item", "UOM", "Expected Qty", "Actual Qty",
    "Batch/Lot", "Mfg Date", "Expiry Date", "Expired", "Damaged Qty", "Damage Reason",
  ];

  const rows: string[] = [header.map(csvCell).join(",")];
  for (const g of (data ?? []) as any[]) {
    const po = one(g.purchase_orders);
    const vendor = one(po?.vendors)?.name ?? "";
    const items = g.grn_line_items ?? [];
    if (items.length === 0) {
      rows.push([g.grn_ref, g.warehouse_code, g.grn_date, g.status, po?.po_number ?? "", vendor, g.invoice_no, g.challan_no].map(csvCell).join(","));
      continue;
    }
    for (const li of items) {
      rows.push([
        g.grn_ref, g.warehouse_code, g.grn_date, g.status, po?.po_number ?? "", vendor,
        g.invoice_no, g.challan_no, one(li.items)?.name ?? "", one(li.uoms)?.code ?? "",
        li.expected_qty, li.actual_qty, li.batch_no, li.mfg_date, li.expiry_date,
        li.expired ? "YES" : "NO", li.damaged_qty, li.damage_reason,
      ].map(csvCell).join(","));
    }
  }

  const csv = rows.join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="grn-export-${status ?? "all"}.csv"`,
    },
  });
}
