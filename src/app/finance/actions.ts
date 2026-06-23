"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase, getSessionRole } from "@/lib/supabase/server";

const VALID = ["pending_review", "discrepancy", "reconciled"] as const;
type Status = (typeof VALID)[number];

const label = (s: string) => s.replace(/_/g, " ");

async function logAudit(
  grnId: string,
  action: string,
  detail: string,
  actorEmail?: string
) {
  const supabase = await createServerSupabase();
  await supabase.from("grn_audit_log").insert({
    grn_id: grnId,
    action,
    detail,
    actor_email: actorEmail ?? null,
  });
}

export async function updateStatus(grnId: string, status: Status) {
  const { user, role } = await getSessionRole();
  if (!user || (role !== "finance" && role !== "admin"))
    return { ok: false as const, error: "Not authorized." };
  if (!VALID.includes(status)) return { ok: false as const, error: "Invalid status." };

  const supabase = await createServerSupabase();

  // Read previous status for the audit trail
  const { data: prev } = await supabase
    .from("grns")
    .select("status")
    .eq("id", grnId)
    .single();

  const { error } = await supabase.from("grns").update({ status }).eq("id", grnId);
  if (error) return { ok: false as const, error: error.message };

  const from = prev?.status ?? "?";
  if (from !== status)
    await logAudit(grnId, "status_change", `${label(from)} → ${label(status)}`, user.email);

  revalidatePath("/finance");
  revalidatePath(`/finance/${grnId}`);
  return { ok: true as const };
}

export async function voidGRN(grnId: string, reason: string) {
  const { user, role } = await getSessionRole();
  if (!user || (role !== "finance" && role !== "admin"))
    return { ok: false as const, error: "Not authorized." };

  const r = reason?.trim();
  if (!r) return { ok: false as const, error: "A reason is required to void a GRN." };

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("grns")
    .update({ voided: true, void_reason: r })
    .eq("id", grnId);
  if (error) return { ok: false as const, error: error.message };

  await logAudit(grnId, "void", `Voided — ${r}`, user.email);

  revalidatePath("/finance");
  revalidatePath(`/finance/${grnId}`);
  return { ok: true as const };
}

export async function unvoidGRN(grnId: string) {
  const { user, role } = await getSessionRole();
  if (!user || (role !== "finance" && role !== "admin"))
    return { ok: false as const, error: "Not authorized." };

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("grns")
    .update({ voided: false, void_reason: null })
    .eq("id", grnId);
  if (error) return { ok: false as const, error: error.message };

  await logAudit(grnId, "unvoid", "Void reversed — GRN reinstated", user.email);

  revalidatePath("/finance");
  revalidatePath(`/finance/${grnId}`);
  return { ok: true as const };
}
