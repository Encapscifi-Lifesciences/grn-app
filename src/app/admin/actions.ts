"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase, getSessionRole } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

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

export async function deleteUser(userId: string) {
  const { user, role: myRole } = await getSessionRole();
  if (!user || myRole !== "admin")
    return { ok: false as const, error: "Not authorized." };
  if (userId === user.id)
    return { ok: false as const, error: "You cannot remove your own account." };

  const admin = getSupabaseAdmin();

  // Remove the profile row first (in case there's no ON DELETE CASCADE), then the
  // auth user. Both run on the service-role client, bypassing RLS.
  await admin.from("profiles").delete().eq("id", userId);
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/admin");
  return { ok: true as const };
}

export async function createUser(formData: FormData) {
  const { user, role: myRole } = await getSessionRole();
  if (!user || myRole !== "admin")
    return { ok: false as const, error: "Not authorized." };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "") as Role;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { ok: false as const, error: "Enter a valid email address." };
  if (password.length < 6)
    return { ok: false as const, error: "Password must be at least 6 characters." };
  if (!ROLES.includes(role))
    return { ok: false as const, error: "Pick a valid role." };

  const admin = getSupabaseAdmin();

  // Create the auth user, auto-confirmed (no email verification needed).
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) return { ok: false as const, error: error.message };

  const newId = data.user?.id;
  if (!newId)
    return { ok: false as const, error: "User created but no id returned." };

  // The on_auth_user_created trigger inserts a profile (default role). Upsert to
  // set the chosen role; bypasses RLS because this runs on the service-role client.
  const { error: roleErr } = await admin
    .from("profiles")
    .upsert({ id: newId, email, role } as never, { onConflict: "id" });
  if (roleErr) {
    return {
      ok: false as const,
      error: `User created, but setting role failed: ${roleErr.message}`,
    };
  }

  revalidatePath("/admin");
  return { ok: true as const };
}
