import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Temporary diagnostic endpoint — shows exactly what the server sees.
export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  let profile: unknown = null;
  let profileError: string | null = null;
  if (user) {
    const res = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    profile = res.data;
    profileError = res.error?.message ?? null;
  }

  return NextResponse.json({
    userId: user?.id ?? null,
    email: user?.email ?? null,
    userError: userErr?.message ?? null,
    profile,
    profileError,
  });
}
