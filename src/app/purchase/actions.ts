"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase, getSessionRole } from "@/lib/supabase/server";

export type POLineInput = {
  itemName: string;
  expectedQty: number;
  uomId: string;
  rate: number;
};

export type POInput = {
  poNumber: string;
  vendorName: string;
  manufacturer: string;
  poDate: string;
  deliveryDate: string;
  paymentTerms: string;
  shipTo: string;
  notes: string;
  source?: "manual" | "pdf";
  lines: POLineInput[];
};

export async function createPO(
  input: POInput
): Promise<{ ok: boolean; error?: string }> {
  const { user, role } = await getSessionRole();
  if (!user || (role !== "purchase" && role !== "admin")) {
    return { ok: false, error: "Not authorized." };
  }

  const supabase = await createServerSupabase();

  const poNumber = input.poNumber?.trim();
  const vendorName = input.vendorName?.trim();
  if (!poNumber) return { ok: false, error: "PO Number is required." };
  if (!vendorName) return { ok: false, error: "Vendor is required." };
  if (!input.poDate) return { ok: false, error: "PO Date is required." };

  const lines = (input.lines || []).filter(
    (l) => l.itemName?.trim() && Number(l.expectedQty) > 0 && l.uomId
  );
  if (lines.length === 0) {
    return { ok: false, error: "Add at least one line item with a quantity." };
  }

  // Vendor (master list)
  const { data: vendor, error: vErr } = await supabase
    .from("vendors")
    .upsert({ name: vendorName }, { onConflict: "name" })
    .select("id")
    .single();
  if (vErr || !vendor) {
    return { ok: false, error: `Vendor error: ${vErr?.message ?? "unknown"}` };
  }

  // PO header
  const { data: po, error: poErr } = await supabase
    .from("purchase_orders")
    .insert({
      po_number: poNumber,
      vendor_id: vendor.id,
      manufacturer: input.manufacturer || null,
      po_date: input.poDate,
      delivery_date: input.deliveryDate || null,
      payment_terms: input.paymentTerms || null,
      ship_to: input.shipTo || null,
      notes: input.notes || null,
      source: input.source ?? "manual",
    })
    .select("id")
    .single();
  if (poErr || !po) {
    if (poErr?.code === "23505") {
      return { ok: false, error: `PO Number "${poNumber}" already exists.` };
    }
    return { ok: false, error: `PO error: ${poErr?.message ?? "unknown"}` };
  }

  // Items (master list)
  const distinctNames = Array.from(new Set(lines.map((l) => l.itemName.trim())));
  const { data: items, error: iErr } = await supabase
    .from("items")
    .upsert(
      distinctNames.map((name) => ({ name })),
      { onConflict: "name" }
    )
    .select("id,name");
  if (iErr || !items) {
    return { ok: false, error: `Item error: ${iErr?.message ?? "unknown"}` };
  }
  const itemIdByName = new Map(items.map((i) => [i.name, i.id]));

  const lineRows = lines.map((l) => ({
    po_id: po.id,
    item_id: itemIdByName.get(l.itemName.trim()),
    expected_qty: Number(l.expectedQty),
    uom_id: l.uomId,
    rate: Number(l.rate) || null,
  }));
  const { error: liErr } = await supabase.from("po_line_items").insert(lineRows);
  if (liErr) {
    return { ok: false, error: `Line items error: ${liErr.message}` };
  }

  revalidatePath("/purchase");
  return { ok: true };
}
