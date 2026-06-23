"use client";

import { useState, useTransition } from "react";
import { updateStatus } from "./actions";

const OPTIONS = [
  { value: "pending_review", label: "Pending Review" },
  { value: "discrepancy", label: "Discrepancy" },
  { value: "reconciled", label: "Reconciled" },
] as const;

export function StatusControl({ grnId, current }: { grnId: string; current: string }) {
  const [value, setValue] = useState(current);
  const [pending, start] = useTransition();

  return (
    <select
      value={value}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value;
        setValue(next);
        start(async () => {
          await updateStatus(grnId, next as (typeof OPTIONS)[number]["value"]);
        });
      }}
      className="rounded-lg border border-zinc-300 px-2 py-1 text-sm outline-none focus:border-teal-600 disabled:opacity-50"
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
