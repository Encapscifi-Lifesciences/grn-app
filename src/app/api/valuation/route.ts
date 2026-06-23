import { createServerSupabase, getSessionRole } from "@/lib/supabase/server";
import { computeValuation } from "@/lib/valuation";

export const dynamic = "force-dynamic";

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const r2 = (n: number) => (Number.isFinite(n) ? Math.round(n * 100) / 100 : 0);

// Admin-only inventory valuation export. ?type=items | fefo
export async function GET(request: Request) {
  const { user, role } = await getSessionRole();
  if (!user || role !== "admin") {
    return new Response("Forbidden", { status: 403 });
  }

  const type = new URL(request.url).searchParams.get("type") ?? "items";
  const supabase = await createServerSupabase();
  const v = await computeValuation(supabase);

  let header: string[];
  let rows: (string | number | null)[][];
  let filename: string;

  if (type === "fefo") {
    header = ["#", "Raw Material", "Batch/Lot", "Available", "UOM", "Unit Cost", "Value", "Expiry Date", "Days Left", "Expired"];
    let cum = 0;
    rows = v.batchesFefo.map((b, i) => {
      cum += b.availableValue;
      return [i + 1, b.itemName, b.batchNo, b.available, b.uom, r2(b.unitCost), r2(b.availableValue), b.expiryDate, b.daysLeft, b.expired ? "YES" : "NO"];
    });
    rows.push(["", "TOTAL", "", "", "", "", r2(cum), "", "", ""]);
    filename = "valuation-fefo.csv";
  } else {
    header = ["Raw Material", "On Hand", "UOM", "WAC Unit Cost", "Actual Value", "WAC Value", "Diff", "Missing Rate"];
    rows = v.items.map((i) => [
      i.itemName, i.onHand, i.uom, r2(i.wacUnit), r2(i.actualValue), r2(i.wacValue),
      r2(i.actualValue - i.wacValue), i.hasMissingCost ? "YES" : "NO",
    ]);
    rows.push(["TOTAL", "", "", "", r2(v.totals.actualValue), r2(v.totals.wacValue), "", ""]);
    filename = "valuation-by-item.csv";
  }

  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
