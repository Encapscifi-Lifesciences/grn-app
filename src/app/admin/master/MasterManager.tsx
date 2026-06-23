"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveVendor,
  deleteVendor,
  saveItem,
  deleteItem,
  saveUom,
  deleteUom,
} from "./actions";

type Kind = "vendor" | "item" | "uom";
type Row = Record<string, string> & { id: string };
type Field = { key: string; label: string; placeholder?: string };

const CONFIG: Record<Kind, { title: string; emoji: string; fields: Field[] }> = {
  vendor: { title: "Vendors", emoji: "🏢", fields: [{ key: "name", label: "Name", placeholder: "Vendor name" }] },
  item: {
    title: "Items / Raw Materials",
    emoji: "🧪",
    fields: [
      { key: "name", label: "Name", placeholder: "Item name" },
      { key: "description", label: "Description", placeholder: "Optional" },
    ],
  },
  uom: {
    title: "Units of Measure",
    emoji: "📏",
    fields: [
      { key: "code", label: "Code", placeholder: "kg" },
      { key: "name", label: "Name", placeholder: "Kilogram" },
    ],
  },
};

async function doSave(kind: Kind, id: string | null, v: Record<string, string>) {
  if (kind === "vendor") return saveVendor(id, v.name ?? "");
  if (kind === "item") return saveItem(id, v.name ?? "", v.description ?? "");
  return saveUom(id, v.code ?? "", v.name ?? "");
}
async function doDelete(kind: Kind, id: string) {
  if (kind === "vendor") return deleteVendor(id);
  if (kind === "item") return deleteItem(id);
  return deleteUom(id);
}

export function MasterManager({ kind, rows }: { kind: Kind; rows: Row[] }) {
  const cfg = CONFIG[kind];
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState<Record<string, string>>({});

  const inp =
    "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900";

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    setErr(null);
    start(async () => {
      const r = await fn();
      if (r.ok) {
        after?.();
        router.refresh();
      } else setErr(r.error ?? "Something went wrong.");
    });
  }

  return (
    <div className="rounded-xl bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3">
        <h2 className="text-sm font-semibold text-zinc-900">
          {cfg.emoji} {cfg.title} <span className="text-zinc-400">({rows.length})</span>
        </h2>
      </div>

      {err && <p className="mx-5 mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

      {/* Add row */}
      <div className="flex flex-wrap items-end gap-2 px-5 py-3">
        {cfg.fields.map((f) => (
          <div key={f.key} className="min-w-[140px] flex-1">
            <label className="block text-xs font-medium text-zinc-500">{f.label}</label>
            <input
              className={inp}
              placeholder={f.placeholder}
              value={adding[f.key] ?? ""}
              onChange={(e) => setAdding((a) => ({ ...a, [f.key]: e.target.value }))}
            />
          </div>
        ))}
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => doSave(kind, null, adding), () => setAdding({}))}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          + Add
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-zinc-500">
            <tr>
              {cfg.fields.map((f) => (
                <th key={f.key} className="px-5 py-2 font-medium">{f.label}</th>
              ))}
              <th className="px-5 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td className="px-5 py-3 text-zinc-500" colSpan={cfg.fields.length + 1}>None yet.</td></tr>
            ) : (
              rows.map((row) => {
                const editing = editId === row.id;
                return (
                  <tr key={row.id} className="border-t border-zinc-100">
                    {cfg.fields.map((f) => (
                      <td key={f.key} className="px-5 py-2">
                        {editing ? (
                          <input
                            className={inp}
                            value={draft[f.key] ?? ""}
                            onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                          />
                        ) : (
                          <span className={f.key === "name" || f.key === "code" ? "font-medium text-zinc-900" : "text-zinc-600"}>
                            {row[f.key] || "—"}
                          </span>
                        )}
                      </td>
                    ))}
                    <td className="px-5 py-2">
                      {editing ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => run(() => doSave(kind, row.id, draft), () => setEditId(null))}
                            className="rounded bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditId(null)}
                            className="rounded border border-zinc-300 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-50"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditId(row.id);
                              const d: Record<string, string> = {};
                              cfg.fields.forEach((f) => (d[f.key] = row[f.key] ?? ""));
                              setDraft(d);
                            }}
                            className="rounded border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => {
                              if (confirm("Delete this entry?")) run(() => doDelete(kind, row.id));
                            }}
                            className="rounded border border-red-300 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
