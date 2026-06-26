/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerSupabase, getSessionRole } from "@/lib/supabase/server";
import { daysToExpiry, expiryStatusLabel, todayUtc } from "@/lib/expiry";

export const dynamic = "force-dynamic";

const one = (x: any) => (Array.isArray(x) ? x[0] : x);

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// CSV export of GRN line items, filtered by status / date range / search. Odoo-friendly.
export async function GET(request: Request) {
  const { user, role } = await getSessionRole();
  if (!user || (role !== "finance" && role !== "admin")) {
    return new Response("Forbidden", { status: 403 });
  }

  const sp = new URL(request.url).searchParams;
  const status = sp.get("status");
  const from = sp.get("from");
  const to = sp.get("to");
  const term = (sp.get("q") ?? "").trim().toLowerCase();

  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from("grns")
    .select(
      "grn_ref, warehouse_code, grn_date, status, voided, void_reason, invoice_no, challan_no, " +
        "purchase_orders(po_number, vendors(name)), " +
        "grn_line_items(expected_qty, actual_qty, batch_no, mfg_date, expiry_date, expired, damaged_qty, damage_reason, items(name), uoms(code))"
    )
    .order("created_at", { ascending: false });

  if (error) return new Response(`Error: ${error.message}`, { status: 500 });

  const vendorOf = (g: any) => one(one(g.purchase_orders)?.vendors)?.name ?? "";
  const poOf = (g: any) => one(g.purchase_orders)?.po_number ?? "";

  // Mirror the dashboard filtering
  const rowsData = (data ?? []).filter((g: any) => {
    if (status === "voided") {
      if (!g.voided) return false;
    } else if (status && status !== "all") {
      if (g.voided || g.status !== status) return false;
    }
    if (from && g.grn_date < from) return false;
    if (to && g.grn_date > to) return false;
    if (term) {
      const hay = [g.grn_ref, poOf(g), vendorOf(g), g.invoice_no, g.challan_no, g.warehouse_code]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(term)) return false;
    }
    return true;
  });

  const today = todayUtc();

  const header = [
    "GRN Ref", "Warehouse", "GRN Date", "Status", "Voided", "PO Number", "Vendor",
    "Invoice No", "Challan No", "Item", "UOM", "Expected Qty", "Actual Qty",
    "Batch/Lot", "Mfg Date", "Expiry Date", "Days to Expiry", "Expiry Status",
    "Expired", "Damaged Qty", "Damage Reason",
  ];

  const rows: string[] = [header.map(csvCell).join(",")];
  for (const g of rowsData as any[]) {
    const po = poOf(g);
    const vendor = vendorOf(g);
    const voided = g.voided ? "YES" : "NO";
    const items = g.grn_line_items ?? [];
    if (items.length === 0) {
      rows.push([g.grn_ref, g.warehouse_code, g.grn_date, g.status, voided, po, vendor, g.invoice_no, g.challan_no].map(csvCell).join(","));
      continue;
    }
    for (const li of items) {
      const dl = daysToExpiry(li.expiry_date, today);
      rows.push([
        g.grn_ref, g.warehouse_code, g.grn_date, g.status, voided, po, vendor,
        g.invoice_no, g.challan_no, one(li.items)?.name ?? "", one(li.uoms)?.code ?? "",
        li.expected_qty, li.actual_qty, li.batch_no, li.mfg_date, li.expiry_date,
        dl ?? "", expiryStatusLabel(dl),
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
