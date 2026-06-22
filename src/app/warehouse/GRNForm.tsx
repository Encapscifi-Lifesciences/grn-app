"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabaseClient";
import { generateGrnRef, fetchPO, createGRN } from "./actions";

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
  expiryDate: string;
  expired: boolean;
  expiryProofUrl: string;
  damagedQty: string;
  damageReason: string;
};

let counter = 0;

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
  const [poId, setPoId] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [challanNo, setChallanNo] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const input =
    "w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 outline-none focus:border-zinc-900";

  async function onWarehouseChange(code: string) {
    setWarehouseCode(code);
    setGrnRef("");
    if (code) {
      const res = await generateGrnRef(code);
      if (res.ok) setGrnRef(res.grnRef);
      else setMsg({ ok: false, text: res.error });
    }
  }

  async function onFetchPO() {
    if (!poNumber.trim()) return;
    setFetching(true);
    setMsg(null);
    const res = await fetchPO(poNumber);
    setFetching(false);
    if (!res.ok) {
      setMsg({ ok: false, text: res.error });
      setLines([]);
      setPoId("");
      return;
    }
    setPoId(res.po.id);
    setVendorName(res.po.vendorName);
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
        expiryDate: "",
        expired: false,
        expiryProofUrl: "",
        damagedQty: "0",
        damageReason: "",
      }))
    );
  }

  function patch(key: number, p: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...p } : l)));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await createGRN({
      warehouseCode,
      grnRef,
      poId,
      invoiceNo,
      challanNo,
      attachmentUrl,
      lines: lines.map((l) => ({
        poLineItemId: l.poLineItemId,
        itemId: l.itemId,
        expectedQty: Number(l.expectedQty),
        actualQty: Number(l.actualQty),
        uomId: l.uomId,
        batchNo: l.batchNo,
        mfgDate: l.mfgDate,
        expiryDate: l.expiryDate,
        expired: l.expired,
        expiryProofUrl: l.expiryProofUrl,
        damagedQty: Number(l.damagedQty),
        damageReason: l.damageReason,
      })),
    });
    setBusy(false);
    if (res.ok) {
      setMsg({ ok: true, text: `GRN ${res.grnRef} saved (status: ${res.status}).` });
      setPoNumber(""); setPoId(""); setVendorName(""); setInvoiceNo("");
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
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-zinc-700">Warehouse</label>
            <select
              className={input}
              value={warehouseCode}
              onChange={(e) => onWarehouseChange(e.target.value)}
              required
            >
              <option value="">Select warehouse…</option>
              <option value="WH1">Warehouse 1 (WH1)</option>
              <option value="WH2">Warehouse 2 (WH2)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700">GRN Reference</label>
            <input className={`${input} bg-zinc-50 font-mono`} value={grnRef} readOnly placeholder="Auto-generated on warehouse select" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-zinc-700">PO Number</label>
            <div className="flex gap-2">
              <input
                className={input}
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onFetchPO(); } }}
                placeholder="Enter PO number, then Fetch"
              />
              <button type="button" onClick={onFetchPO} disabled={fetching}
                className="shrink-0 rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700 disabled:opacity-50">
                {fetching ? "Fetching…" : "Fetch"}
              </button>
            </div>
            {vendorName && <p className="mt-1 text-sm text-zinc-500">Vendor: {vendorName}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700">Invoice No.</label>
            <input className={input} value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700">Challan No.</label>
            <input className={input} value={challanNo} onChange={(e) => setChallanNo(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Line items */}
      {lines.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-zinc-900">Received Items ({lines.length})</h3>
          {lines.map((l) => (
            <div key={l.key} className="rounded-xl bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-medium text-zinc-900">{l.itemName}</span>
                <span className="text-sm text-zinc-500">Expected: {l.expectedQty} {l.uomCode}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-600">Actual Qty Received</label>
                  <input type="number" step="any" min="0" className={input} value={l.actualQty}
                    onChange={(e) => patch(l.key, { actualQty: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600">Batch / Lot No.</label>
                  <input className={input} value={l.batchNo} onChange={(e) => patch(l.key, { batchNo: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600">Damaged Qty</label>
                  <input type="number" step="any" min="0" className={input} value={l.damagedQty}
                    onChange={(e) => patch(l.key, { damagedQty: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600">Mfg Date</label>
                  <input type="date" className={input} value={l.mfgDate} onChange={(e) => patch(l.key, { mfgDate: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600">Expiry Date</label>
                  <input type="date" className={input} value={l.expiryDate} onChange={(e) => patch(l.key, { expiryDate: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600">Damage Reason</label>
                  <input className={input} value={l.damageReason} placeholder="e.g. 2 bags torn"
                    onChange={(e) => patch(l.key, { damageReason: e.target.value })} />
                </div>
              </div>

              {/* Expired flag + proof */}
              <div className="mt-3 rounded-lg bg-amber-50 p-3">
                <label className="flex items-center gap-2 text-sm font-medium text-amber-900">
                  <input type="checkbox" checked={l.expired}
                    onChange={(e) => patch(l.key, { expired: e.target.checked })} />
                  Item is expired
                </label>
                {l.expired && (
                  <div className="mt-2">
                    <label className="block text-xs font-medium text-amber-800">Expiry proof (photo)</label>
                    <input type="file" accept="image/*" capture="environment" className="mt-1 text-sm"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          const url = await uploadFile(`expiry/${l.key}`, f);
                          if (url) patch(l.key, { expiryProofUrl: url });
                          else setMsg({ ok: false, text: "Photo upload failed." });
                        }
                      }} />
                    {l.expiryProofUrl && <p className="mt-1 text-xs text-green-700">✓ proof uploaded</p>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form-level attachment */}
      {lines.length > 0 && (
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <label className="block text-sm font-medium text-zinc-700">
            Delivery Challan / Damage Photo
          </label>
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
        <p className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {msg.text}
        </p>
      )}

      {lines.length > 0 && (
        <div className="flex justify-end">
          <button type="submit" disabled={busy}
            className="rounded-lg bg-zinc-900 px-5 py-2.5 font-medium text-white hover:bg-zinc-700 disabled:opacity-50">
            {busy ? "Saving…" : "Submit GRN"}
          </button>
        </div>
      )}
    </form>
  );
}
