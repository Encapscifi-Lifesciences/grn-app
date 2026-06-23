"use client";

import { useState, useTransition } from "react";
import { getSupabaseBrowser } from "@/lib/supabaseClient";
import { setExpired } from "./actions";

export function InventoryActions({
  id,
  expired,
  proofUrl,
}: {
  id: string;
  expired: boolean;
  proofUrl: string | null;
}) {
  const [pending, start] = useTransition();
  const [proof, setProof] = useState(proofUrl ?? "");
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    setUploading(true);
    const supabase = getSupabaseBrowser();
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `expiry/${Date.now()}-${safe}`;
    const { error } = await supabase.storage.from("grn-attachments").upload(path, file);
    setUploading(false);
    if (!error) {
      setProof(supabase.storage.from("grn-attachments").getPublicUrl(path).data.publicUrl);
    }
  }

  if (expired) {
    return (
      <div className="flex items-center gap-2">
        {proof && (
          <a href={proof} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline">proof</a>
        )}
        <button
          disabled={pending}
          onClick={() => start(async () => { await setExpired(id, false); })}
          className="rounded-lg border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Unmark
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="file"
        accept="image/*"
        className="w-24 text-xs"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }}
      />
      <button
        disabled={pending || uploading}
        onClick={() => start(async () => { await setExpired(id, true, proof); })}
        className="rounded-lg bg-amber-600 px-2 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
      >
        {uploading ? "…" : "Mark Expired"}
      </button>
    </div>
  );
}
