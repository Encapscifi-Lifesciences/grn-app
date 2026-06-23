"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div
      className="flex flex-1 items-center justify-center p-4"
      style={{
        backgroundImage:
          'linear-gradient(to bottom right, rgba(15,23,42,0.92), rgba(13,148,136,0.82)), url("https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&w=1600&q=80")',
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl bg-white/95 p-8 shadow-xl ring-1 ring-black/5 backdrop-blur"
      >
        <div className="flex items-center gap-2 text-2xl">💊📦</div>
        <h1 className="mt-3 text-xl font-bold text-zinc-900">Encapscifi GRN</h1>
        <p className="mt-1 text-sm text-zinc-500">
          🔐 Sign in to the Goods Received Note system
        </p>

        <label className="mt-6 block text-sm font-medium text-zinc-700">
          Email
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 outline-none focus:border-teal-600"
          placeholder="you@encapscifi.com"
        />

        <label className="mt-4 block text-sm font-medium text-zinc-700">
          Password
        </label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 outline-none focus:border-teal-600"
          placeholder="••••••••"
        />

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-lg bg-teal-600 py-2.5 font-medium text-white transition-colors hover:bg-teal-700 disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
