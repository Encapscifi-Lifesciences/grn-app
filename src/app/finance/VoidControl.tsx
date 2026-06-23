"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { voidGRN, unvoidGRN } from "./actions";

export function VoidControl({
  grnId,
  voided,
}: {
  grnId: string;
  voided: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);

  if (voided) {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await unvoidGRN(grnId);
            if (r.ok) router.refresh();
            else setErr(r.error);
          })
        }
        className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-slate-50 disabled:opacity-50"
      >
        Reinstate
      </button>
    );
  }

  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="rounded-lg border border-red-300 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
      >
        Void
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <input
        autoFocus
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason to void…"
        className="w-40 rounded border border-zinc-300 px-2 py-1 text-xs outline-none focus:border-red-500"
      />
      <div className="flex gap-1">
        <button
          type="button"
          disabled={pending || !reason.trim()}
          onClick={() =>
            start(async () => {
              const r = await voidGRN(grnId, reason);
              if (r.ok) {
                setAsking(false);
                setReason("");
                router.refresh();
              } else setErr(r.error);
            })
          }
          className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {pending ? "…" : "Confirm"}
        </button>
        <button
          type="button"
          onClick={() => {
            setAsking(false);
            setReason("");
            setErr(null);
          }}
          className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-600 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
      {err && <span className="text-xs text-red-600">{err}</span>}
    </div>
  );
}
