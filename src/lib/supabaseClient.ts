import { createBrowserClient } from "@supabase/ssr";

// Browser client — uses the public anon key, safe to ship to the browser.
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
