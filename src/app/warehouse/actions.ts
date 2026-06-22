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

// Fetch a PO and all its line items for the GRN form
export async function fetchPO(poNumber: string) {
  const supabase = await createServerSupabase();
  const { data: po, error } = await supabase
    .from("purchase_orders")
    .select(
      "id, po_number, vendors(name), po_line_items(id, expected_qty, item_id, items(name), uoms(id, code))"
    )
    .eq("po_number", poNumber.trim())
    .maybeSingle();

  if (error) return { ok: false as const, error: error.message };
  if (!po) return { ok: false as const, error: `PO "${poNumber}" not found.` };

  const lines = (po as any).po_line_items.map((l: any) => ({
    poLineItemId: l.id,
    itemId: l.item_id,
    itemName: one(l.items)?.name ?? "",
    expectedQty: String(l.expected_qty),
    uomId: one(l.uoms)?.id ?? "",
    uomCode: one(l.uoms)?.code ?? "",
  }));

  return {
    ok: true as const,
    po: {
      id: (po as any).id,
      poNumber: (po as any).po_number,
      vendorName: one((po as any).vendors)?.name ?? "",
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
  expired: boolean;
  expiryProofUrl: string;
  damagedQty: number;
  damageReason: string;
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

  // Discrepancy if any received qty differs from expected, or items are damaged/expired
  const discrepancy = input.lines.some(
    (l) =>
      Number(l.actualQty) !== Number(l.expectedQty) ||
      l.expired ||
      Number(l.damagedQty) > 0
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
    expired: !!l.expired,
    expiry_proof_url: l.expiryProofUrl || null,
    damaged_qty: Number(l.damagedQty) || 0,
    damage_reason: l.damageReason || null,
  }));

  const { error: lErr } = await supabase.from("grn_line_items").insert(rows);
  if (lErr) return { ok: false as const, error: lErr.message };

  revalidatePath("/finance");
  revalidatePath("/warehouse");
  return { ok: true as const, grnRef: input.grnRef, status };
}
