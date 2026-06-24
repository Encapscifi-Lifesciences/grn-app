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
  rate: string;
};

let lineCounter = 0;
function newLine(defaultUomId: string): Line {
  return { key: ++lineCounter, itemName: "", expectedQty: "", uomId: defaultUomId, rate: "" };
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

  const uomByCode = new Map<string, string>();
  for (const u of uoms) uomByCode.set(u.code.toLowerCase(), u.id);
  const aliasUom = (raw: string): string => {
    const r = raw.toLowerCase();
    const alias: Record<string, string> = {
      kg: "kg", kilogram: "kg", kilograms: "kg",
      g: "g", gram: "g", grams: "g",
      l: "L", ltr: "L", liter: "L", litre: "L", liters: "L", litres: "L",
      unit: "units", units: "units", no: "units", nos: "units", pc: "units", pcs: "units",
    };
    const code = alias[r] ?? r;
    return uomByCode.get(code.toLowerCase()) ?? defaultUom;
  };

  const [poNumber, setPoNumber] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [poDate, setPoDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [deliveryDate, setDeliveryDate] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [shipTo, setShipTo] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([newLine(defaultUom)]);
  const [busy, setBusy] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function updateLine(key: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((prev) => [...prev, newLine(defaultUom)]);
  }
  function removeLine(key: number) {
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((l) => l.key !== key)));
  }

  async function onPdf(file: File) {
    setParsing(true);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/parse-po", { method: "POST", body: fd });
      const data = await res.json();
      if (data.error) { setMessage({ ok: false, text: data.error }); setParsing(false); return; }
      if (data.poNumber) setPoNumber(data.poNumber);
      if (data.vendorName) setVendorName(data.vendorName);
      if (data.poDate) setPoDate(data.poDate);
      if (Array.isArray(data.lines) && data.lines.length > 0) {
        setLines(
          data.lines.map((l: { itemName: string; expectedQty: string; uom: string; rate?: string }) => ({
            key: ++lineCounter,
            itemName: l.itemName,
            expectedQty: String(l.expectedQty),
            uomId: aliasUom(l.uom),
            rate: l.rate ? String(l.rate) : "",
          }))
        );
        setMessage({ ok: true, text: `Extracted ${data.lines.length} item(s) — please review before saving.` });
      } else {
        setMessage({ ok: true, text: "PDF read, but no line items detected. Enter them manually." });
      }
    } catch {
      setMessage({ ok: false, text: "Failed to read PDF. Enter the items manually." });
    }
    setParsing(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const res = await createPO({
      poNumber, vendorName, manufacturer, poDate, deliveryDate, paymentTerms, shipTo, notes,
      source: "manual",
      lines: lines.map((l) => ({
        itemName: l.itemName,
        expectedQty: Number(l.expectedQty),
        uomId: l.uomId,
        rate: Number(l.rate),
      })),
    });
    setBusy(false);
    if (res.ok) {
      setMessage({ ok: true, text: `PO "${poNumber}" saved.` });
      setPoNumber(""); setVendorName(""); setManufacturer(""); setDeliveryDate(""); setPaymentTerms("");
      setShipTo(""); setNotes(""); setLines([newLine(defaultUom)]);
      router.refresh();
    } else {
      setMessage({ ok: false, text: res.error ?? "Something went wrong." });
    }
  }

  const input =
    "w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 outline-none focus:border-teal-600";

  return (
    <form onSubmit={onSubmit} className="rounded-xl bg-white p-5 shadow-sm sm:p-6">
      {/* PDF upload (Option B) */}
      <div className="mb-6 rounded-lg border border-dashed border-zinc-300 bg-slate-100 p-4">
        <label className="block text-sm font-medium text-zinc-700">
          Option B — Upload PO PDF (auto-fills the form below)
        </label>
        <input type="file" accept="application/pdf" className="mt-2 text-sm"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onPdf(f); }} />
        {parsing && <p className="mt-1 text-xs text-zinc-500">Reading PDF…</p>}
        <p className="mt-1 text-xs text-zinc-400">Or fill in the fields manually below (Option A).</p>
      </div>

      {/* Header fields */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="block text-sm font-medium text-zinc-700">PO Number</label>
          <input className={input} value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="PO-2026-001" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Vendor</label>
          <input className={input} list="vendor-list" value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="Type or pick a vendor" required />
          <datalist id="vendor-list">{vendors.map((v) => <option key={v.id} value={v.name} />)}</datalist>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Manufacturer</label>
          <input className={input} value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} placeholder="Manufacturer name" />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">PO Date</label>
          <input type="date" className={input} value={poDate} onChange={(e) => setPoDate(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Expected Delivery Date</label>
          <input type="date" className={input} value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Payment Terms</label>
          <input className={input} value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="e.g. Net 30" />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Ship To / Location</label>
          <input className={input} value={shipTo} onChange={(e) => setShipTo(e.target.value)} placeholder="Warehouse / address" />
        </div>
        <div className="sm:col-span-3">
          <label className="block text-sm font-medium text-zinc-700">Notes</label>
          <input className={input} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any special instructions" />
        </div>
      </div>

      {/* Line items */}
      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-900">Line Items</h3>
          <button type="button" onClick={addLine} className="rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700">+ Add Line Item</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-zinc-500">
                <th className="py-2 pr-3 font-medium">Item</th>
                <th className="py-2 pr-3 font-medium">Expected Qty</th>
                <th className="py-2 pr-3 font-medium">UOM</th>
                <th className="py-2 pr-3 font-medium">Rate (₹)</th>
                <th className="py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.key} className="border-t border-zinc-100">
                  <td className="py-2 pr-3">
                    <input className={input} list="item-list" value={l.itemName} onChange={(e) => updateLine(l.key, { itemName: e.target.value })} placeholder="Type or pick an item" />
                  </td>
                  <td className="py-2 pr-3">
                    <input type="number" step="any" min="0" className={input} value={l.expectedQty} onChange={(e) => updateLine(l.key, { expectedQty: e.target.value })} placeholder="0" />
                  </td>
                  <td className="py-2 pr-3">
                    <select className={input} value={l.uomId} onChange={(e) => updateLine(l.key, { uomId: e.target.value })}>
                      {uoms.map((u) => <option key={u.id} value={u.id}>{u.code}</option>)}
                    </select>
                  </td>
                  <td className="py-2 pr-3">
                    <input type="number" step="any" min="0" className={input} value={l.rate} onChange={(e) => updateLine(l.key, { rate: e.target.value })} placeholder="0.00" />
                  </td>
                  <td className="py-2 text-right">
                    <button type="button" onClick={() => removeLine(l.key)} className="rounded-lg px-2 py-1 text-zinc-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove line">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <datalist id="item-list">{items.map((i) => <option key={i.id} value={i.name} />)}</datalist>
      </div>

      {message && (
        <p className={`mt-4 rounded-lg px-3 py-2 text-sm ${message.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{message.text}</p>
      )}

      <div className="mt-6 flex justify-end">
        <button type="submit" disabled={busy} className="rounded-lg bg-teal-600 px-5 py-2.5 font-medium text-white hover:bg-teal-700 disabled:opacity-50">
          {busy ? "Saving…" : "Save Purchase Order"}
        </button>
      </div>
    </form>
  );
}
