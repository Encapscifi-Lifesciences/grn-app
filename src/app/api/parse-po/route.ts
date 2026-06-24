import { NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Convert "20/06/2026" (DD/MM/YYYY) -> "2026-06-20" for <input type="date">.
function toISODate(s: string): string {
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return "";
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

// A line looks like part of a postal address (skip when hunting for a vendor name).
function looksLikeAddress(line: string): boolean {
  return (
    /\d/.test(line) ||
    /,/.test(line) ||
    /\b(road|cross|stage|taluk|district|nagar|street|st\.|po box|pin|pincode|india|gstin|phone|email|tamil|karnataka|kerala|state)\b/i.test(
      line
    )
  );
}

// Best-effort PO PDF parser, tuned for the company's Odoo export but tolerant of
// other layouts. Extracts PO number, vendor, order date, and "item qty uom rate"
// rows. The Purchase form lets the user review/edit whatever is detected.
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

    const buf = Buffer.from(await file.arrayBuffer());
    const parser = new PDFParse({ data: new Uint8Array(buf) });
    const parsed = await parser.getText();
    const text = parsed.text || "";
    const allLines = text.split(/\r?\n/).map((l) => l.trim());

    // ---- PO number: "Purchase Order #PO/2026/00202", "PO No: 1234" ----
    const poMatch = text.match(
      /(?:purchase\s*order|p\.?\s*o\.?)\s*(?:no\.?|number|#|:)?\s*[:#-]?\s*([A-Za-z0-9][A-Za-z0-9\-\/_]{2,})/i
    );
    const poNumber = poMatch ? poMatch[1].trim() : "";

    // ---- Order date: "Order Date:\n20/06/2026" ----
    const dateMatch = text.match(/order\s*date\s*:?\s*([0-3]?\d\/[01]?\d\/\d{4})/i);
    const poDate = dateMatch ? toISODate(dateMatch[1]) : "";

    // ---- Vendor name ----
    // Odoo prints the supplier block (name, address, GSTIN) just above the
    // "Purchase Order #" title. Walk up from the supplier's GSTIN line and take
    // the first non-address line — that's the vendor name. Falls back to a
    // labelled "Vendor:/Supplier:" if present.
    let vendorName = "";
    const poIdx = allLines.findIndex((l) => /purchase\s*order\s*#/i.test(l));
    if (poIdx > 0) {
      const head = allLines.slice(0, poIdx);
      let gstinIdx = -1;
      for (let i = head.length - 1; i >= 0; i--) {
        if (/gstin/i.test(head[i])) { gstinIdx = i; break; }
      }
      const from = gstinIdx >= 0 ? gstinIdx - 1 : head.length - 1;
      for (let i = from; i >= 0; i--) {
        const line = head[i];
        if (!line) continue;
        if (/shipping address|^buyer$/i.test(line)) break;
        if (!looksLikeAddress(line)) { vendorName = line; break; }
      }
    }
    if (!vendorName) {
      const vMatch = text.match(/(?:vendor|supplier)\s*[:#-]?\s*([A-Za-z0-9 .,&'-]{3,})/i);
      vendorName = vMatch ? vMatch[1].split(/\n/)[0].trim() : "";
    }

    // ---- Line items ----
    // Odoo prints the items table tab-delimited, e.g.
    //   "Coconut MCT oil \t 700.00 kg \t 560.0000 \t 0.00% \t IGST 18% \t ₹ ..."
    // so column 0 = description, column 1 = "qty uom", column 2 = unit price.
    // For non-tabbed PDFs we fall back to a "name qty uom [rate]" regex.
    const uomWord =
      "(kg|g|gram|grams|kilogram|kilograms|l|ltr|liter|litre|liters|litres|ml|unit|units|no|nos|pc|pcs)";
    const qtyUomRe = new RegExp(`^(\\d+(?:[.,]\\d+)?)\\s*${uomWord}\\b`, "i");
    const lineRe = new RegExp(
      `^(.{2,}?)\\s+(\\d+(?:\\.\\d+)?)\\s*${uomWord}\\b(?:\\s+(\\d+(?:\\.\\d+)?))?`,
      "i"
    );
    const num = (s: string) => s.replace(/,/g, "").trim();
    const isHeaderish = (s: string) =>
      /total|subtotal|amount|gst\b|tax|description|untaxed|qty|unit price/i.test(s);

    const lines: { itemName: string; expectedQty: string; uom: string; rate: string }[] = [];
    const rawLines = text.split(/\r?\n/); // keep tabs (don't pre-trim)
    for (const raw of rawLines) {
      // Tab-delimited path
      if (raw.includes("\t")) {
        const cells = raw.split(/\t/).map((c) => c.trim());
        const name = cells[0]?.replace(/^\d+[).\s]+/, "").trim();
        const qm = cells[1]?.match(qtyUomRe);
        if (name && qm && !isHeaderish(name)) {
          lines.push({
            itemName: name,
            expectedQty: num(qm[1]),
            uom: qm[2].toLowerCase(),
            rate: cells[2] ? num(cells[2]) : "",
          });
          continue;
        }
      }
      // Space-delimited fallback
      const m = raw.trim().match(lineRe);
      if (m) {
        const name = m[1].replace(/^\d+[).\s]+/, "").trim();
        if (name && !isHeaderish(name)) {
          lines.push({
            itemName: name,
            expectedQty: m[2],
            uom: m[3].toLowerCase(),
            rate: m[4] ?? "",
          });
        }
      }
    }

    return NextResponse.json({ poNumber, vendorName, poDate, lines });
  } catch (e) {
    return NextResponse.json(
      { error: "Could not read PDF. Enter the items manually.", detail: String(e) },
      { status: 200 }
    );
  }
}
