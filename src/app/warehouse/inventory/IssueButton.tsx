"use client";

import { useState, useTransition } from "react";
import { issueStock } from "./actions";

export function IssueButton({
  grnLineItemId,
  itemId,
  available,
}: {
  grnLineItemId: string;
  itemId: string;
  available: number;
}) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (available <= 0) return <span className="text-xs text-zinc-400">—</span>;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
      >
        Issue
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <input
          type="number" step="any" min="0" max={available}
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          placeholder="Qty"
          className="w-16 rounded border border-zinc-300 px-1.5 py-1 text-xs"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="note"
          className="w-20 rounded border border-zinc-300 px-1.5 py-1 text-xs"
        />
        <button
          disabled={pending}
          onClick={() => {
            const q = Number(qty);
            if (!(q > 0)) { setErr("Enter qty"); return; }
            if (q > available) { setErr(`Max ${available}`); return; }
            setErr(null);
            start(async () => {
              const res = await issueStock(grnLineItemId, itemId, q, note);
              if (res.ok) { setOpen(false); setQty(""); setNote(""); }
              else setErr(res.error);
            });
          }}
          className="rounded bg-zinc-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
        >
          {pending ? "…" : "Save"}
        </button>
        <button onClick={() => { setOpen(false); setErr(null); }} className="px-1 text-xs text-zinc-400">✕</button>
      </div>
      {err && <span className="text-xs text-red-600">{err}</span>}
    </div>
  );
}
