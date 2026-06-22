"use client";

import { useState, useTransition } from "react";
import { setMinLevel } from "./actions";

export function MinLevelInput({ itemId, current }: { itemId: string; current: number }) {
  const [value, setValue] = useState(String(current ?? 0));
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  function save() {
    if (Number(value) === Number(current)) return;
    setSaved(false);
    start(async () => {
      const res = await setMinLevel(itemId, Number(value));
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 1200); }
    });
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="number" step="any" min="0"
        value={value}
        disabled={pending}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        className="w-20 rounded border border-zinc-300 px-1.5 py-1 text-sm disabled:opacity-50"
      />
      {saved && <span className="text-xs text-green-600">✓</span>}
    </span>
  );
}
