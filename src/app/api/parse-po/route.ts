import { NextResponse } from "next/server";
import { getDocumentProxy } from "unpdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Convert "20/06/2026" (DD/MM/YYYY) -> "2026-06-20" for <input type="date">.
function toISODate(s: string): string {
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return "";
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

// Rebuild the visual layout from positioned text items: group items into rows by
// their y coordinate, sort each row left-to-right, and insert a TAB where there's
// a wide horizontal gap (a column break). This preserves the PO's table columns.
function reconstructRows(items: any[]): string[] {
  const rows: { y: number; cells: { x: number; str: string }[] }[] = [];
  for (const it of items) {
    const str: string = it.str ?? "";
    if (!str.trim()) continue;
    const x = it.transform[4];
    const y = Math.round(it.transform[5]);
    let row = rows.find((r) => Math.abs(r.y - y) <= 3);
    if (!row) {
      row = { y, cells: [] };
      rows.push(row);
    }
    row.cells.push({ x, str });
  }
  rows.sort((a, b) => b.y - a.y); // page top -> bottom
  return rows.map((r) => {
    r.cells.sort((a, b) => a.x - b.x);
    let line = "";
    let prevEnd: number | null = null;
    for (const c of r.cells) {
      if (prevEnd !== null && c.x - prevEnd > 25) line += "\t";
      else if (line) line += " ";
      line += c.str;
      prevEnd = c.x + c.str.length * 4; // rough end-x estimate
    }
    return line;
  });
}

const isHeaderish = (s: string) =>
  /total|subtotal|amount|gst\b|tax|description|untaxed|qty|unit price/i.test(s);

// Best-effort PO PDF parser. Uses unpdf (serverless-safe) to extract positioned
// text, rebuilds the table, then pulls out PO number, vendor, order date and the
// "item qty uom rate" rows. The Purchase form lets the user edit before saving.
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

    const buf = Buffer.from(await file.arrayBuffer());
    const pdf = await getDocumentProxy(new Uint8Array(buf));

    const rows: string[] = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      rows.push(...reconstructRows(tc.items));
    }
    const flat = rows.join(" ");

    // ---- PO number: "Purchase Order #PO/2026/00202", "PO No: 1234" ----
    const poMatch = flat.match(
      /(?:purchase\s*order|p\.?\s*o\.?)\s*(?:no\.?|number|#|:)?\s*[:#-]?\s*([A-Za-z0-9][A-Za-z0-9\-\/_]{2,})/i
    );
    const poNumber = poMatch ? poMatch[1].trim() : "";

    // ---- Order date: label and value sit in aligned columns of adjacent rows ----
    let poDate = "";
    const labelRowIdx = rows.findIndex((r) => /order\s*date/i.test(r));
    if (labelRowIdx >= 0) {
      const labelCells = rows[labelRowIdx].split(/\t/);
      const col = labelCells.findIndex((c) => /order\s*date/i.test(c));
      const valueRow = rows[labelRowIdx + 1]?.split(/\t/);
      const cell = valueRow?.[col] ?? "";
      poDate = toISODate(cell) || toISODate(rows[labelRowIdx + 1] ?? "");
    }
    if (!poDate) poDate = toISODate(flat.match(/order\s*date[^0-9]*([0-3]?\d\/[01]?\d\/\d{4})/i)?.[1] ?? "");

    // ---- Vendor: right-hand column of the "Shipping address:" row ----
    let vendorName = "";
    const shipRow = rows.find((r) => /^shipping address/i.test(r));
    if (shipRow) {
      const cells = shipRow.split(/\t/).map((c) => c.trim());
      if (cells[1]) vendorName = cells[1];
    }
    if (!vendorName) {
      const vMatch = flat.match(/(?:vendor|supplier)\s*[:#-]?\s*([A-Za-z0-9 .,&'-]{3,})/i);
      vendorName = vMatch ? vMatch[1].split(/\t/)[0].trim() : "";
    }

    // ---- Line items: tab-delimited "name <TAB> qty uom <TAB> unit-price ..." ----
    const uomWord =
      "(kg|g|gram|grams|kilogram|kilograms|l|ltr|liter|litre|liters|litres|ml|unit|units|no|nos|pc|pcs)";
    const qtyUomRe = new RegExp(`^(\\d+(?:[.,]\\d+)?)\\s*${uomWord}\\b`, "i");
    const num = (s: string) => s.replace(/,/g, "").trim();
    const lines: { itemName: string; expectedQty: string; uom: string; rate: string }[] = [];
    for (const row of rows) {
      if (!row.includes("\t")) continue;
      const cells = row.split(/\t/).map((c) => c.trim());
      const name = cells[0]?.replace(/^\d+[).\s]+/, "").trim();
      const qm = cells[1]?.match(qtyUomRe);
      if (name && qm && !isHeaderish(name)) {
        lines.push({
          itemName: name,
          expectedQty: num(qm[1]),
          uom: qm[2].toLowerCase(),
          rate: cells[2] ? num(cells[2]) : "",
        });
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
