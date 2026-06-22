import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabaseConfig";

// Lazily create the service-role client. NEVER import into a client component.
// Created on first call so an empty/missing key never crashes at build time.
let adminClient: ReturnType<typeof createClient> | undefined;

export function getSupabaseAdmin() {
  if (!adminClient) {
    // Strip a leading BOM / stray whitespace — the Vercel env vars have been
    // known to carry an invisible BOM that breaks the auth header (see
    // supabaseConfig.ts). A clean key is required for the admin API to work.
    const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "")
      .replace(/^﻿/, "")
      .trim();
    adminClient = createClient(SUPABASE_URL, key, {
      auth: { persistSession: false },
    });
  }
  return adminClient;
}
