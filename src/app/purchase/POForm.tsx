"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPO } from "./actions";

type Vendor = { id: string; name: string };
type Item = { id: string; name: string };
type Uom = { id: string; code: string; name: string };

type Line = {
  key: number;
  itemName: string;
  expectedQty: string;
  uomId: string;
};

let lineCounter = 0;
function newLine(defaultUomId: string): Line {
  return { key: ++lineCounter, itemName: "", expectedQty: "", uomId: defaultUomId };
}

export default function POForm({
  vendors,
  items,
  uoms,
}: {
  vendors: Vendor[];
  items: Item[];
  uoms: Uom[];
}) {
  const router = useRouter();
  const defaultUom = uoms[0]?.id ?? "";

  const [poNumber, setPoNumber] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [poDate, setPoDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<Line[]>([newLine(defaultUom)]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null
  );

  function updateLine(key: number, patch: Partial<Line>) {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, ...patch } : l))
    );
  }
  function addLine() {
    setLines((prev) => [...prev, newLine(defaultUom)]);
  }
  function removeLine(key: number) {
    setLines((prev) =>
      prev.length === 1 ? prev : prev.filter((l) => l.key !== key)
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);

    const res = await createPO({
      poNumber,
      vendorName,
      poDate,
      source: "manual",
      lines: lines.map((l) => ({
        itemName: l.itemName,
        expectedQty: Number(l.expectedQty),
        uomId: l.uomId,
      })),
    });

    setBusy(false);
    if (res.ok) {
      setMessage({ ok: true, text: `PO "${poNumber}" saved.` });
      setPoNumber("");
      setVendorName("");
      setLines([newLine(defaultUom)]);
      router.refresh();
    } else {
      setMessage({ ok: false, text: res.error ?? "Something went wrong." });
    }
  }

  const input =
    "w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 outline-none focus:border-zinc-900";

  return (
    <form onSubmit={onSubmit} className="rounded-xl bg-white p-5 shadow-sm sm:p-6">
      {/* Header fields */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="block text-sm font-medium text-zinc-700">
            PO Number
          </label>
          <input
            className={input}
            value={poNumber}
            onChange={(e) => setPoNumber(e.target.value)}
            placeholder="PO-2026-001"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">
            Vendor
          </label>
          <input
            className={input}
            list="vendor-list"
            value={vendorName}
            onChange={(e) => setVendorName(e.target.value)}
            placeholder="Type or pick a vendor"
            required
          />
          <datalist id="vendor-list">
            {vendors.map((v) => (
              <option key={v.id} value={v.name} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">
            PO Date
          </label>
          <input
            type="date"
            className={input}
            value={poDate}
            onChange={(e) => setPoDate(e.target.value)}
            required
          />
        </div>
      </div>

      {/* Line items */}
      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-900">Line Items</h3>
          <button
            type="button"
            onClick={addLine}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700"
          >
            + Add Line Item
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-zinc-500">
                <th className="py-2 pr-3 font-medium">Item</th>
                <th className="py-2 pr-3 font-medium">Expected Qty</th>
                <th className="py-2 pr-3 font-medium">UOM</th>
                <th className="py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.key} className="border-t border-zinc-100">
                  <td className="py-2 pr-3">
                    <input
                      className={input}
                      list="item-list"
                      value={l.itemName}
                      onChange={(e) =>
                        updateLine(l.key, { itemName: e.target.value })
                      }
                      placeholder="Type or pick an item"
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className={input}
                      value={l.expectedQty}
                      onChange={(e) =>
                        updateLine(l.key, { expectedQty: e.target.value })
                      }
                      placeholder="0"
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <select
                      className={input}
                      value={l.uomId}
                      onChange={(e) =>
                        updateLine(l.key, { uomId: e.target.value })
                      }
                    >
                      {uoms.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.code}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      onClick={() => removeLine(l.key)}
                      className="rounded-lg px-2 py-1 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                      aria-label="Remove line"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <datalist id="item-list">
          {items.map((i) => (
            <option key={i.id} value={i.name} />
          ))}
        </datalist>
      </div>

      {message && (
        <p
          className={`mt-4 rounded-lg px-3 py-2 text-sm ${
            message.ok
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </p>
      )}

      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-zinc-900 px-5 py-2.5 font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save Purchase Order"}
        </button>
      </div>
    </form>
  );
}
