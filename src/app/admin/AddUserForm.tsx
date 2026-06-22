"use client";

import { useRef, useState, useTransition } from "react";
import { createUser } from "./actions";

const ROLES = [
  { value: "warehouse", label: "Warehouse" },
  { value: "purchase", label: "Purchase" },
  { value: "finance", label: "Finance" },
  { value: "admin", label: "Admin" },
] as const;

export function AddUserForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm sm:p-5">
      <h2 className="mb-3 text-sm font-semibold text-zinc-900">Add a new user</h2>
      <form
        ref={formRef}
        action={(fd) =>
          start(async () => {
            setMsg(null);
            const res = await createUser(fd);
            if (res.ok) {
              setMsg({ ok: true, text: "✓ User created. They can sign in now." });
              formRef.current?.reset();
            } else {
              setMsg({ ok: false, text: res.error });
            }
          })
        }
        className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end"
      >
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="off"
            placeholder="person@example.com"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
          Password
          <input
            name="password"
            type="text"
            required
            minLength={6}
            autoComplete="new-password"
            placeholder="min 6 characters"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
          Role
          <select
            name="role"
            defaultValue="warehouse"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900"
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add user"}
        </button>
      </form>
      {msg && (
        <p
          className={`mt-3 rounded-lg px-3 py-2 text-sm ${
            msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}
