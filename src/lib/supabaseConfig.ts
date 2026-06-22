// Supabase project URL and anon (public) key.
// These two are PUBLIC by design: the anon key is shipped to every browser and
// is gated by Row Level Security, so it is safe to keep in source as a fallback.
// Vercel env vars take precedence if set; the constants ensure the app always
// has valid credentials regardless of deployment env-var issues.
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://arthlaobnvaexzayhhuk.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFydGhsYW9ibnZhZXh6YXloaHVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMDU5NDMsImV4cCI6MjA5NzY4MTk0M30.WZ0IHRlDfoJaD2cd1V5P8W6Nrt8rhuhzufnIt3etyWI";
