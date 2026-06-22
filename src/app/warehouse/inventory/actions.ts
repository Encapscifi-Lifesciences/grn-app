"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase, getSessionRole } from "@/lib/supabase/server";

async function requireWarehouse() {
  const { user, role } = await getSessionRole();
  if (!user || (role !== "warehouse" && role !== "admin")) return null;
  return await createServerSupabase();
}

// Mark/unmark a received batch as expired
export async function setExpired(lineId: string, expired: boolean, proofUrl?: string) {
  const supabase = await requireWarehouse();
  if (!supabase) return { ok: false as const, error: "Not authorized." };

  const patch: Record<string, unknown> = { expired };
  if (expired && proofUrl) patch.expiry_proof_url = proofUrl;
  const { error } = await supabase.from("grn_line_items").update(patch).eq("id", lineId);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/warehouse/inventory");
  return { ok: true as const };
}

// Record consumption / issue of stock from a specific batch
export async function issueStock(
  grnLineItemId: string,
  itemId: string,
  qty: number,
  note: string
) {
  const supabase = await requireWarehouse();
  if (!supabase) return { ok: false as const, error: "Not authorized." };
  if (!(qty > 0)) return { ok: false as const, error: "Quantity must be greater than 0." };

  const { error } = await supabase.from("stock_issues").insert({
    grn_line_item_id: grnLineItemId,
    item_id: itemId,
    qty,
    note: note || null,
  });
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/warehouse/inventory");
  return { ok: true as const };
}

// Set the minimum (reorder) level for an item
export async function setMinLevel(itemId: string, minLevel: number) {
  const supabase = await requireWarehouse();
  if (!supabase) return { ok: false as const, error: "Not authorized." };

  const { error } = await supabase
    .from("items")
    .update({ min_level: Number(minLevel) || 0 })
    .eq("id", itemId);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/warehouse/inventory");
  return { ok: true as const };
}
