"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase, getSessionRole } from "@/lib/supabase/server";

const VALID = ["pending_review", "discrepancy", "reconciled"] as const;
type Status = (typeof VALID)[number];

export async function updateStatus(grnId: string, status: Status) {
  const { user, role } = await getSessionRole();
  if (!user || (role !== "finance" && role !== "admin"))
    return { ok: false as const, error: "Not authorized." };
  if (!VALID.includes(status)) return { ok: false as const, error: "Invalid status." };

  const supabase = await createServerSupabase();
  const { error } = await supabase.from("grns").update({ status }).eq("id", grnId);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/finance");
  revalidatePath(`/finance/${grnId}`);
  return { ok: true as const };
}
