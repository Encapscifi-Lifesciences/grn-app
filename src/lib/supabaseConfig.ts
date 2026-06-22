// Supabase project URL and anon (public) key.
// These two are PUBLIC by design: the anon key is shipped to every browser and
// is gated by Row Level Security, so it is safe to keep in source.
// Hardcoded (no process.env) on purpose: the Vercel env vars were corrupted with
// an invisible BOM character that broke HTTP headers. Using clean literals here
// guarantees valid credentials in every build.
export const SUPABASE_URL = "https://arthlaobnvaexzayhhuk.supabase.co";

export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFydGhsYW9ibnZhZXh6YXloaHVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMDU5NDMsImV4cCI6MjA5NzY4MTk0M30.WZ0IHRlDfoJaD2cd1V5P8W6Nrt8rhuhzufnIt3etyWI";
