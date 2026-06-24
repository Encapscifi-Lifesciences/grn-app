"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteUser } from "./actions";

export function DeleteUserButton({ userId, email, isSelf }: { userId: string; email: string; isSelf: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  if (isSelf) {
    return <span className="text-xs text-zinc-400">(you)</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm(`Remove user "${email}"? This permanently deletes their login. This cannot be undone.`)) return;
          setErr(null);
          start(async () => {
            const res = await deleteUser(userId);
            if (res.ok) router.refresh();
            else setErr(res.error);
          });
        }}
        className="rounded-lg border border-red-200 px-3 py-1 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        {pending ? "Removing…" : "Remove"}
      </button>
      {err && <span className="text-xs text-red-600">{err}</span>}
    </div>
  );
}
