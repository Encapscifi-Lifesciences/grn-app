import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabaseConfig";

// Lazily create the browser client on first use (inside event handlers),
// so it is never instantiated during server prerendering of client pages.
let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function getSupabaseBrowser() {
  if (!browserClient) {
    browserClient = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return browserClient;
}
