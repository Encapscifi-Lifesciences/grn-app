"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase, getSessionRole } from "@/lib/supabase/server";

const ROLES = ["purchase", "warehouse", "finance", "admin"] as const;
type Role = (typeof ROLES)[number];

export async function changeRole(userId: string, role: Role) {
  const { user, role: myRole } = await getSessionRole();
  if (!user || myRole !== "admin")
    return { ok: false as const, error: "Not authorized." };
  if (!ROLES.includes(role)) return { ok: false as const, error: "Invalid role." };

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("set_user_role", {
    target: userId,
    new_role: role,
  });
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/admin");
  return { ok: true as const };
}
