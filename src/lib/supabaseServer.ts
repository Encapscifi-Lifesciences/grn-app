import { createClient } from "@supabase/supabase-js";

// Lazily create the service-role client. NEVER import into a client component.
// Created on first call so an empty/missing key never crashes at build time.
let adminClient: ReturnType<typeof createClient> | undefined;

export function getSupabaseAdmin() {
  if (!adminClient) {
    adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
  }
  return adminClient;
}
