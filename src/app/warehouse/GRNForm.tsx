"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabaseClient";
import { generateGrnRef, fetchPO, createGRN, listOpenPOs } from "./actions";

type Line = {
  key: number;
  poLineItemId: string;
  itemId: string;
  itemName: string;
  expectedQty: string;
  uomId: string;
  uomCode: string;
  actualQty: string;
  batchNo: string;
  mfgDate: string;
  shelfLifeMonths: string;
  expiryDate: string;
  damaged: boolean;
  damagedQty: string;
  damageReason: string;
  damageProofUrl: string;
};

type PODetails = {
  poDate: string;
  deliveryDate: string;
  paymentTerms: string;
  shipTo: string;
  vendorName: string;
  manufacturer: string;
};

let counter = 0;

// Add N months to a YYYY-MM-DD date string -> YYYY-MM-DD
function addMonths(dateStr: string, months: number): string {
  if (!dateStr || !months) return "";
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

// Whole months between two YYYY-MM-DD dates (mfg -> expiry) as a string, "" if invalid
function monthsBetween(from: string, to: string): string {
  if (!from || !to) return "";
  const a = new Date(from);
  const b = new Date(to);
  if (isNaN(a.getTime()) || isNaN(b.getTime()) || b < a) return "";
  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) months -= 1;
  return months >= 0 ? String(months) : "";
}

async function uploadFile(folder: string, file: File): Promise<string | null> {
  const supabase = getSupabaseBrowser();
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${folder}/${Date.now()}-${safe}`;
  const { error } = await supabase.storage.from("grn-attachments").upload(path, file);
  if (error) return null;
  return supabase.storage.from("grn-attachments").getPublicUrl(path).data.publicUrl;
}

export default function GRNForm() {
  const router = useRouter();
  const [warehouseCode, setWarehouseCode] = useState("");
  const [grnRef, setGrnRef] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [poOptions, setPoOptions] = useState<{ poNumber: string; vendorName: string }[]>([]);
  const [poId, setPoId] = useState("");
  const [po, setPo] = useState<PODetails | null>(null);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [challanNo, setChallanNo] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [lastGrn, setLastGrn] = useState<{ id: string; ref: string } | null>(null);

  const input = "field";

  // Load the list of uploaded POs for the dropdown
  useEffect(() => {
    listOpenPOs().then((res) => {
      if (res.ok) setPoOptions(res.pos);
    });
  }, []);

  async function onWarehouseChange(code: string) {
    setWarehouseCode(code);
    setGrnRef("");
    if (code) {
      const res = await generateGrnRef(code);
      if (res.ok) setGrnRef(res.grnRef);
      else setMsg({ ok: false, text: res.error });
    }
  }

  async function onFetchPO(numberOverride?: string) {
    const num = (numberOverride ?? poNumber).trim();
    if (!num) return;
    setFetching(true);
    setMsg(null);
    const res = await fetchPO(num);
    setFetching(false);
    if (!res.ok) {
      setMsg({ ok: false, text: res.error });
      setLines([]); setPoId(""); setPo(null);
      return;
    }
    setPoId(res.po.id);
    setPo({
      poDate: res.po.poDate,
      deliveryDate: res.po.deliveryDate,
      paymentTerms: res.po.paymentTerms,
      shipTo: res.po.shipTo,
      vendorName: res.po.vendorName,
      manufacturer: res.po.manufacturer,
    });
    setLines(
      res.po.lines.map((l: any) => ({
        key: ++counter,
        poLineItemId: l.poLineItemId,
        itemId: l.itemId,
        itemName: l.itemName,
        expectedQty: l.expectedQty,
        uomId: l.uomId,
        uomCode: l.uomCode,
        actualQty: l.expectedQty,
        batchNo: "",
        mfgDate: "",
        shelfLifeMonths: "",
        expiryDate: "",
        damaged: false,
        damagedQty: "0",
        damageReason: "",
        damageProofUrl: "",
      }))
    );
  }

  function patch(key: number, p: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...p } : l)));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const missingBatch = lines.find((l) => Number(l.actualQty) > 0 && !l.batchNo.trim());
    if (missingBatch) {
      setMsg({ ok: false, text: `Batch / Lot No. is required for "${missingBatch.itemName}".` });
      return;
    }
    setBusy(true);
    setMsg(null);
    const res = await createGRN({
      warehouseCode, grnRef, poId, invoiceNo, challanNo, attachmentUrl,
      lines: lines.map((l) => ({
        poLineItemId: l.poLineItemId,
        itemId: l.itemId,
        expectedQty: Number(l.expectedQty),
        actualQty: Number(l.actualQty),
        uomId: l.uomId,
        batchNo: l.batchNo,
        mfgDate: l.mfgDate,
        expiryDate: l.expiryDate,
        damagedQty: l.damaged ? Number(l.damagedQty) : 0,
        damageReason: l.damaged ? l.damageReason : "",
        damageProofUrl: l.damaged ? l.damageProofUrl : "",
      })),
    });
    setBusy(false);
    if (res.ok) {
      setMsg({ ok: true, text: `GRN ${res.grnRef} saved (status: ${res.status}).` });
      setLastGrn({ id: res.id, ref: res.grnRef });
      setPoNumber(""); setPoId(""); setPo(null); setInvoiceNo("");
      setChallanNo(""); setAttachmentUrl(""); setLines([]);
      setWarehouseCode(""); setGrnRef("");
      router.refresh();
    } else {
      setMsg({ ok: false, text: res.error });
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Header */}
      <div className="card p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-lg ring-1 ring-teal-100">📥</span>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Receipt Details</h2>
            <p className="text-xs text-slate-500">Select the warehouse and the purchase order being received.</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-zinc-700">Warehouse</label>
            <select className={input} value={warehouseCode} onChange={(e) => onWarehouseChange(e.target.value)} required>
              <option value="">Select warehouse…</option>
              <option value="WH1">Warehouse 1 (WH1)</option>
              <option value="WH2">Warehouse 2 (WH2)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700">GRN Reference</label>
            <input className={`${input} bg-slate-100 font-mono`} value={grnRef} readOnly placeholder="Auto-generated on warehouse select" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-zinc-700">PO Number</label>
            <select
              className={input}
              value={poNumber}
              disabled={fetching}
              onChange={(e) => {
                const num = e.target.value;
                setPoNumber(num);
                if (num) onFetchPO(num);
                else { setPoId(""); setPo(null); setLines([]); }
              }}
            >
              <option value="">
                {poOptions.length ? "Select a PO…" : "No POs uploaded yet"}
              </option>
              {poOptions.map((p) => (
                <option key={p.poNumber} value={p.poNumber}>
                  {p.poNumber}{p.vendorName ? ` — ${p.vendorName}` : ""}
                </option>
              ))}
            </select>
            {fetching && <p className="mt-1 text-xs text-zinc-500">Fetching PO…</p>}
          </div>
        </div>

        {/* Fetched PO details */}
        {po && (
          <div className="mt-4 grid gap-2 rounded-lg bg-slate-100 p-4 text-sm sm:grid-cols-2">
            <div><span className="text-zinc-500">Vendor:</span> <span className="font-medium">{po.vendorName || "—"}</span></div>
            <div><span className="text-zinc-500">Manufacturer:</span> <span className="font-medium">{po.manufacturer || "—"}</span></div>
            <div><span className="text-zinc-500">PO Date:</span> {po.poDate || "—"}</div>
            <div><span className="text-zinc-500">Delivery Date:</span> {po.deliveryDate || "—"}</div>
            <div><span className="text-zinc-500">Payment Terms:</span> {po.paymentTerms || "—"}</div>
            <div className="sm:col-span-2"><span className="text-zinc-500">Ship To:</span> {po.shipTo || "—"}</div>
          </div>
        )}

        {lines.length > 0 && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-zinc-700">Invoice No.</label>
              <input className={input} value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700">Challan No.</label>
              <input className={input} value={challanNo} onChange={(e) => setChallanNo(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      {/* Line items */}
      {lines.length > 0 && (
        <div className="space-y-4">
          <h3 className="section-title px-1">Received Items ({lines.length})</h3>
          {lines.map((l) => (
            <div key={l.key} className="card p-5">
              <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="font-semibold text-slate-900">{l.itemName}</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">Expected: {l.expectedQty} {l.uomCode}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-600">Actual Qty Received</label>
                  <input type="number" step="any" min="0" className={input} value={l.actualQty} onChange={(e) => patch(l.key, { actualQty: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600">Batch / Lot No. <span className="text-red-500">*</span></label>
                  <input className={input} value={l.batchNo} required={Number(l.actualQty) > 0} onChange={(e) => patch(l.key, { batchNo: e.target.value })} />
                  {Number(l.actualQty) > 0 && !l.batchNo.trim() && (
                    <p className="mt-1 text-xs text-red-600">Required for traceability.</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600">Mfg Date</label>
                  <input type="date" className={input} value={l.mfgDate}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (l.shelfLifeMonths)
                        patch(l.key, { mfgDate: v, expiryDate: addMonths(v, Number(l.shelfLifeMonths)) });
                      else if (l.expiryDate)
                        patch(l.key, { mfgDate: v, shelfLifeMonths: monthsBetween(v, l.expiryDate) });
                      else patch(l.key, { mfgDate: v });
                    }} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600">Shelf Life (months) <span className="text-zinc-400">(auto / editable)</span></label>
                  <input type="number" min="0" step="1" className={input} value={l.shelfLifeMonths} placeholder="e.g. 24"
                    onChange={(e) => {
                      const v = e.target.value;
                      patch(l.key, { shelfLifeMonths: v, expiryDate: l.mfgDate && v ? addMonths(l.mfgDate, Number(v)) : l.expiryDate });
                    }} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600">Expiry Date <span className="text-zinc-400">(auto / editable)</span></label>
                  <input type="date" className={input} value={l.expiryDate}
                    onChange={(e) => {
                      const v = e.target.value;
                      patch(l.key, { expiryDate: v, shelfLifeMonths: l.mfgDate ? monthsBetween(l.mfgDate, v) : l.shelfLifeMonths });
                    }} />
                  {l.mfgDate && l.expiryDate && l.expiryDate <= l.mfgDate && (
                    <p className="mt-1 text-xs text-red-600">Expiry must be after mfg date.</p>
                  )}
                </div>
              </div>

              {/* Damaged condition */}
              <div className="mt-3 rounded-lg bg-red-50 p-3">
                <label className="flex items-center gap-2 text-sm font-medium text-red-900">
                  <input type="checkbox" checked={l.damaged} onChange={(e) => patch(l.key, { damaged: e.target.checked })} />
                  Goods damaged / rejected
                </label>
                {l.damaged && (
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-red-800">Damaged Qty</label>
                      <input type="number" step="any" min="0" className={input} value={l.damagedQty} onChange={(e) => patch(l.key, { damagedQty: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-red-800">Reason</label>
                      <input className={input} value={l.damageReason} placeholder="e.g. 2 bags torn" onChange={(e) => patch(l.key, { damageReason: e.target.value })} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-red-800">Damage proof (photo)</label>
                      <input type="file" accept="image/*" capture="environment" className="mt-1 text-sm"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            const url = await uploadFile(`damage/${l.key}`, f);
                            if (url) patch(l.key, { damageProofUrl: url });
                            else setMsg({ ok: false, text: "Photo upload failed." });
                          }
                        }} />
                      {l.damageProofUrl && <p className="mt-1 text-xs text-green-700">✓ proof uploaded</p>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form-level attachment */}
      {lines.length > 0 && (
        <div className="card p-5">
          <label className="block text-sm font-medium text-zinc-700">Delivery Challan Photo</label>
          <input type="file" accept="image/*" capture="environment" className="mt-1 text-sm"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) {
                const url = await uploadFile("challan", f);
                if (url) setAttachmentUrl(url);
                else setMsg({ ok: false, text: "Photo upload failed." });
              }
            }} />
          {attachmentUrl && <p className="mt-1 text-xs text-green-700">✓ photo uploaded</p>}
        </div>
      )}

      {msg && (
        <p className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{msg.text}</p>
      )}

      {lastGrn && (
        <div className="flex items-center justify-between rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm">
          <span className="text-teal-800">GRN <span className="font-mono font-medium">{lastGrn.ref}</span> created.</span>
          <Link
            href={`/grn/${lastGrn.id}`}
            target="_blank"
            className="rounded-lg bg-teal-600 px-3 py-1.5 font-medium text-white hover:bg-teal-700"
          >
            ⬇ Download GRN PDF
          </Link>
        </div>
      )}

      {lines.length > 0 && (
        <div className="sticky bottom-0 z-10 -mx-4 flex justify-end border-t border-slate-200 bg-white/80 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:px-5 sm:shadow-sm">
          <button type="submit" disabled={busy} className="btn-primary w-full px-5 py-3 text-base sm:w-auto sm:py-2.5 sm:text-sm">
            {busy ? "Saving…" : "Submit GRN ✓"}
          </button>
        </div>
      )}
    </form>
  );
}
