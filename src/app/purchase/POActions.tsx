"use client";

import { useState, useTransition } from "react";
import { cancelPO, deletePO } from "./actions";

export function POActions({
  poId,
  cancelled,
  hasGRN,
}: {
  poId: string;
  cancelled: boolean;
  hasGRN: boolean;
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      {cancelled ? (
        <button
          disabled={pending}
          onClick={() => start(async () => { await cancelPO(poId, false); })}
          className="rounded-lg border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
        >
          Reactivate
        </button>
      ) : (
        <button
          disabled={pending}
          onClick={() => start(async () => { await cancelPO(poId, true); })}
          className="rounded-lg border border-amber-300 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
        >
          Cancel
        </button>
      )}
      {!hasGRN && (
        <button
          disabled={pending}
          onClick={() => {
            if (!confirm("Delete this PO permanently? This cannot be undone.")) return;
            setErr(null);
            start(async () => {
              const res = await deletePO(poId);
              if (!res.ok) setErr(res.error);
            });
          }}
          className="rounded-lg border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          Delete
        </button>
      )}
      {err && <span className="text-xs text-red-600">{err}</span>}
    </div>
  );
}
