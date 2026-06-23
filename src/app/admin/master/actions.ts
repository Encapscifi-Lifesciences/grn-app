"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase, getSessionRole } from "@/lib/supabase/server";

async function requireAdmin() {
  const { user, role } = await getSessionRole();
  if (!user || role !== "admin") return null;
  return user;
}

const PATH = "/admin/master";
type Res = { ok: true } | { ok: false; error: string };

// Count rows in `table` where `col` = value; used to block deletes that would orphan data.
async function refCount(table: string, col: string, value: string): Promise<number> {
  const supabase = await createServerSupabase();
  const { count } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq(col, value);
  return count ?? 0;
}

// ---------------- VENDORS ----------------
export async function saveVendor(id: string | null, name: string): Promise<Res> {
  if (!(await requireAdmin())) return { ok: false, error: "Not authorized." };
  const n = name.trim();
  if (!n) return { ok: false, error: "Vendor name is required." };
  const supabase = await createServerSupabase();
  const { error } = id
    ? await supabase.from("vendors").update({ name: n }).eq("id", id)
    : await supabase.from("vendors").insert({ name: n });
  if (error)
    return { ok: false, error: error.code === "23505" ? `Vendor "${n}" already exists.` : error.message };
  revalidatePath(PATH);
  return { ok: true };
}

export async function deleteVendor(id: string): Promise<Res> {
  if (!(await requireAdmin())) return { ok: false, error: "Not authorized." };
  if ((await refCount("purchase_orders", "vendor_id", id)) > 0)
    return { ok: false, error: "Cannot delete — this vendor is used on purchase orders." };
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("vendors").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(PATH);
  return { ok: true };
}

// ---------------- ITEMS ----------------
export async function saveItem(
  id: string | null,
  name: string,
  description: string
): Promise<Res> {
  if (!(await requireAdmin())) return { ok: false, error: "Not authorized." };
  const n = name.trim();
  if (!n) return { ok: false, error: "Item name is required." };
  const supabase = await createServerSupabase();
  const payload = { name: n, description: description.trim() || null };
  const { error } = id
    ? await supabase.from("items").update(payload).eq("id", id)
    : await supabase.from("items").insert(payload);
  if (error)
    return { ok: false, error: error.code === "23505" ? `Item "${n}" already exists.` : error.message };
  revalidatePath(PATH);
  return { ok: true };
}

export async function deleteItem(id: string): Promise<Res> {
  if (!(await requireAdmin())) return { ok: false, error: "Not authorized." };
  if ((await refCount("po_line_items", "item_id", id)) > 0)
    return { ok: false, error: "Cannot delete — this item is used on purchase orders." };
  if ((await refCount("grn_line_items", "item_id", id)) > 0)
    return { ok: false, error: "Cannot delete — this item is used on GRNs." };
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("items").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(PATH);
  return { ok: true };
}

// ---------------- UOMs ----------------
export async function saveUom(
  id: string | null,
  code: string,
  name: string
): Promise<Res> {
  if (!(await requireAdmin())) return { ok: false, error: "Not authorized." };
  const c = code.trim();
  const n = name.trim();
  if (!c) return { ok: false, error: "UOM code is required." };
  if (!n) return { ok: false, error: "UOM name is required." };
  const supabase = await createServerSupabase();
  const { error } = id
    ? await supabase.from("uoms").update({ code: c, name: n }).eq("id", id)
    : await supabase.from("uoms").insert({ code: c, name: n });
  if (error)
    return { ok: false, error: error.code === "23505" ? `UOM "${c}" already exists.` : error.message };
  revalidatePath(PATH);
  return { ok: true };
}

export async function deleteUom(id: string): Promise<Res> {
  if (!(await requireAdmin())) return { ok: false, error: "Not authorized." };
  if ((await refCount("po_line_items", "uom_id", id)) > 0)
    return { ok: false, error: "Cannot delete — this UOM is used on purchase orders." };
  if ((await refCount("grn_line_items", "uom_id", id)) > 0)
    return { ok: false, error: "Cannot delete — this UOM is used on GRNs." };
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("uoms").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(PATH);
  return { ok: true };
}
