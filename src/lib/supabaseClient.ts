import { createBrowserClient } from "@supabase/ssr";

// Lazily create the browser client on first use (inside event handlers),
// so it is never instantiated during server prerendering of client pages.
let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function getSupabaseBrowser() {
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return browserClient;
}
