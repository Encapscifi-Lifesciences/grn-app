"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { revalidatePath } from "next/cache";
import { createServerSupabase, getSessionRole } from "@/lib/supabase/server";

const one = (x: any) => (Array.isArray(x) ? x[0] : x);

// Generate the next GRN reference for a warehouse: WH1-YYMMDD-001
export async function generateGrnRef(warehouseCode: string) {
  const { user, role } = await getSessionRole();
  if (!user || (role !== "warehouse" && role !== "admin"))
    return { ok: false as const, error: "Not authorized." };
  if (warehouseCode !== "WH1" && warehouseCode !== "WH2")
    return { ok: false as const, error: "Invalid warehouse." };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("next_grn_ref", { p_wh: warehouseCode });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, grnRef: data as string };
}

// List uploaded (non-cancelled) POs for the GRN dropdown
export async function listOpenPOs() {
  const { user, role } = await getSessionRole();
  if (!user || (role !== "warehouse" && role !== "admin"))
    return { ok: false as const, error: "Not authorized." };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("purchase_orders")
    .select("po_number, po_date, cancelled, vendors(name)")
    .or("cancelled.is.null,cancelled.eq.false")
    .order("po_date", { ascending: false });

  if (error) return { ok: false as const, error: error.message };

  const pos = (data ?? []).map((p: any) => ({
    poNumber: p.po_number as string,
    vendorName: one(p.vendors)?.name ?? "",
  }));
  return { ok: true as const, pos };
}

// Fetch a PO header + all its line items for the GRN form
export async function fetchPO(poNumber: string) {
  const supabase = await createServerSupabase();
  const { data: po, error } = await supabase
    .from("purchase_orders")
    .select(
      "id, po_number, manufacturer, cancelled, po_date, delivery_date, payment_terms, ship_to, notes, " +
        "vendors(name), " +
        "po_line_items(id, expected_qty, rate, item_id, items(name), uoms(id, code))"
    )
    .eq("po_number", poNumber.trim())
    .maybeSingle();

  if (error) return { ok: false as const, error: error.message };
  if (!po) return { ok: false as const, error: `PO "${poNumber}" not found.` };
  if ((po as any).cancelled)
    return { ok: false as const, error: `PO "${poNumber}" has been cancelled.` };

  const p = po as any;
  const lines = p.po_line_items.map((l: any) => ({
    poLineItemId: l.id,
    itemId: l.item_id,
    itemName: one(l.items)?.name ?? "",
    expectedQty: String(l.expected_qty),
    rate: l.rate != null ? String(l.rate) : "",
    uomId: one(l.uoms)?.id ?? "",
    uomCode: one(l.uoms)?.code ?? "",
  }));

  return {
    ok: true as const,
    po: {
      id: p.id,
      poNumber: p.po_number,
      manufacturer: p.manufacturer ?? "",
      poDate: p.po_date ?? "",
      deliveryDate: p.delivery_date ?? "",
      paymentTerms: p.payment_terms ?? "",
      shipTo: p.ship_to ?? "",
      notes: p.notes ?? "",
      vendorName: one(p.vendors)?.name ?? "",
      lines,
    },
  };
}

export type GRNLineInput = {
  poLineItemId: string;
  itemId: string;
  expectedQty: number;
  actualQty: number;
  uomId: string;
  batchNo: string;
  mfgDate: string;
  expiryDate: string;
  damagedQty: number;
  damageReason: string;
  damageProofUrl: string;
};

export type GRNInput = {
  warehouseCode: string;
  grnRef: string;
  poId: string;
  invoiceNo: string;
  challanNo: string;
  attachmentUrl: string;
  lines: GRNLineInput[];
};

export async function createGRN(input: GRNInput) {
  const { user, role } = await getSessionRole();
  if (!user || (role !== "warehouse" && role !== "admin"))
    return { ok: false as const, error: "Not authorized." };

  if (!input.warehouseCode) return { ok: false as const, error: "Select a warehouse." };
  if (!input.grnRef) return { ok: false as const, error: "GRN reference is missing." };
  if (!input.poId) return { ok: false as const, error: "Fetch a PO first." };
  if (!input.lines?.length) return { ok: false as const, error: "No line items to record." };

  // ---- Validation guards ----
  for (const l of input.lines) {
    const actual = Number(l.actualQty);
    const damaged = Number(l.damagedQty) || 0;
    if (actual < 0) return { ok: false as const, error: "Actual quantity cannot be negative." };
    if (damaged < 0) return { ok: false as const, error: "Damaged quantity cannot be negative." };
    if (damaged > actual)
      return { ok: false as const, error: "Damaged quantity cannot exceed the actual quantity received." };
    if (l.mfgDate && l.expiryDate && l.expiryDate <= l.mfgDate)
      return { ok: false as const, error: "Expiry date must be after the manufacturing date." };
  }

  const discrepancy = input.lines.some(
    (l) => Number(l.actualQty) !== Number(l.expectedQty) || Number(l.damagedQty) > 0
  );
  const status = discrepancy ? "discrepancy" : "pending_review";

  const supabase = await createServerSupabase();
  const { data: grn, error: gErr } = await supabase
    .from("grns")
    .insert({
      grn_ref: input.grnRef,
      warehouse_code: input.warehouseCode,
      po_id: input.poId,
      invoice_no: input.invoiceNo || null,
      challan_no: input.challanNo || null,
      attachment_url: input.attachmentUrl || null,
      status,
    })
    .select("id")
    .single();

  if (gErr || !grn) {
    if (gErr?.code === "23505")
      return { ok: false as const, error: `GRN ${input.grnRef} already exists.` };
    return { ok: false as const, error: gErr?.message ?? "Failed to save GRN." };
  }

  const rows = input.lines.map((l) => ({
    grn_id: grn.id,
    po_line_item_id: l.poLineItemId,
    item_id: l.itemId,
    expected_qty: Number(l.expectedQty),
    actual_qty: Number(l.actualQty) || 0,
    uom_id: l.uomId || null,
    batch_no: l.batchNo || null,
    mfg_date: l.mfgDate || null,
    expiry_date: l.expiryDate || null,
    expired: false,
    damaged_qty: Number(l.damagedQty) || 0,
    damage_reason: l.damageReason || null,
    damage_proof_url: l.damageProofUrl || null,
  }));

  const { error: lErr } = await supabase.from("grn_line_items").insert(rows);
  if (lErr) return { ok: false as const, error: lErr.message };

  revalidatePath("/finance");
  revalidatePath("/warehouse");
  revalidatePath("/warehouse/inventory");
  return { ok: true as const, grnRef: input.grnRef, status };
}
