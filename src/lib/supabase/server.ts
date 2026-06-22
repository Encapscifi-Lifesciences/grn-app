import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabaseConfig";

// Cookie-aware Supabase client for Server Components, Server Actions and Route Handlers.
// It carries the logged-in user's session, so all queries run as that user (RLS applies).
export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // In Server Components this throws (read-only) — safe to ignore there;
          // the proxy refreshes the session cookies for those requests.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            /* called from a Server Component — ignore */
          }
        },
      },
    }
  );
}

export type Role = "purchase" | "warehouse" | "finance" | "admin";

// Returns the current user and their role (null if not logged in).
export async function getSessionRole(): Promise<{
  user: { id: string; email?: string } | null;
  role: Role | null;
}> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, role: null };

  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return {
    user: { id: user.id, email: user.email },
    role: (data?.role ?? null) as Role | null,
  };
}

// Guards a page: redirects to /login if not authenticated, or to the hub if the
// role is not allowed. `admin` can access everything.
export async function requireRole(allowed: Role[]) {
  const { user, role } = await getSessionRole();
  if (!user) redirect("/login");
  if (!role || (role !== "admin" && !allowed.includes(role))) redirect("/");
  return { user, role: role as Role };
}
