"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase, getSessionRole } from "@/lib/supabase/server";

export async function setExpired(
  lineId: string,
  expired: boolean,
  proofUrl?: string
) {
  const { user, role } = await getSessionRole();
  if (!user || (role !== "warehouse" && role !== "admin"))
    return { ok: false as const, error: "Not authorized." };

  const supabase = await createServerSupabase();
  const patch: Record<string, unknown> = { expired };
  if (expired && proofUrl) patch.expiry_proof_url = proofUrl;

  const { error } = await supabase
    .from("grn_line_items")
    .update(patch)
    .eq("id", lineId);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/warehouse/inventory");
  return { ok: true as const };
}
