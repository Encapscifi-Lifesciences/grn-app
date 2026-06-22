"use client";

import { useState, useTransition } from "react";
import { changeRole } from "./actions";

const ROLES = [
  { value: "purchase", label: "Purchase" },
  { value: "warehouse", label: "Warehouse" },
  { value: "finance", label: "Finance" },
  { value: "admin", label: "Admin" },
] as const;

export function RoleSelect({ userId, current }: { userId: string; current: string }) {
  const [value, setValue] = useState(current);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <select
        value={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as (typeof ROLES)[number]["value"];
          setValue(next);
          setSaved(false);
          start(async () => {
            const res = await changeRole(userId, next);
            if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 1500); }
          });
        }}
        className="rounded-lg border border-zinc-300 px-2 py-1 text-sm outline-none focus:border-zinc-900 disabled:opacity-50"
      >
        {ROLES.map((r) => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </select>
      {saved && <span className="text-xs text-green-600">✓ saved</span>}
    </div>
  );
}
