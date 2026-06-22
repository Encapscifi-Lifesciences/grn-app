import { NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Best-effort PO PDF parser. Extracts text, then heuristically pulls out the
// PO number and any "item ... qty uom" rows. The Purchase form lets the user
// review/edit whatever is detected before saving.
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

    const buf = Buffer.from(await file.arrayBuffer());
    const parser = new PDFParse({ data: new Uint8Array(buf) });
    const parsed = await parser.getText();
    const text = parsed.text || "";

    // PO number: e.g. "PO No: 1234", "Purchase Order #PO-2026-01"
    const poMatch = text.match(
      /(?:purchase\s*order|p\.?\s*o\.?)\s*(?:no\.?|number|#|:)?\s*[:#-]?\s*([A-Za-z0-9][A-Za-z0-9\-\/_]{2,})/i
    );
    const poNumber = poMatch ? poMatch[1].trim() : "";

    // Vendor: a "Vendor:/Supplier:" label if present
    const vMatch = text.match(/(?:vendor|supplier)\s*[:#-]?\s*([A-Za-z0-9 .,&'-]{3,})/i);
    const vendorName = vMatch ? vMatch[1].split(/\n/)[0].trim() : "";

    // Line items: lines like "Vitamin C 100 kg" or "Magnesium Stearate  25  KG"
    const uomWord = "(kg|g|gram|grams|kilogram|kilograms|l|ltr|liter|litre|liters|litres|unit|units|no|nos|pc|pcs)";
    const lineRe = new RegExp(`^(.{2,}?)\\s+(\\d+(?:\\.\\d+)?)\\s*${uomWord}\\b`, "i");
    const lines: { itemName: string; expectedQty: string; uom: string }[] = [];
    for (const raw of text.split(/\r?\n/)) {
      const m = raw.trim().match(lineRe);
      if (m) {
        const name = m[1].replace(/^\d+[).\s]+/, "").trim(); // strip leading "1) "
        if (name && !/total|subtotal|amount|gst|tax/i.test(name)) {
          lines.push({ itemName: name, expectedQty: m[2], uom: m[3].toLowerCase() });
        }
      }
    }

    return NextResponse.json({ poNumber, vendorName, lines });
  } catch (e) {
    return NextResponse.json(
      { error: "Could not read PDF. Enter the items manually.", detail: String(e) },
      { status: 200 }
    );
  }
}
