import { requireRole, createServerSupabase } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import POForm from "./POForm";
import { POActions } from "./POActions";

export const dynamic = "force-dynamic";

export default async function PurchasePage() {
  const { user } = await requireRole(["purchase"]);
  const supabase = await createServerSupabase();

  const [vendorsRes, itemsRes, uomsRes, posRes] = await Promise.all([
    supabase.from("vendors").select("id,name").order("name"),
    supabase.from("items").select("id,name").order("name"),
    supabase.from("uoms").select("id,code,name").order("code"),
    supabase
      .from("purchase_orders")
      .select("id,po_number,po_date,cancelled,vendors(name),po_line_items(id),grns(id)")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const recent = (posRes.data ?? []) as Array<{
    id: string;
    po_number: string;
    po_date: string;
    cancelled: boolean;
    vendors: { name: string } | { name: string }[] | null;
    po_line_items: { id: string }[];
    grns: { id: string }[];
  }>;

  const vendorName = (v: (typeof recent)[number]["vendors"]) =>
    Array.isArray(v) ? v[0]?.name : v?.name;

  return (
    <div className="flex flex-1 flex-col bg-slate-50">
      <AppHeader title="Purchase Portal" email={user.email} back />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-8 p-6">
        <section>
          <h2 className="mb-3 text-lg font-semibold text-zinc-900">
            New Purchase Order
          </h2>
          <POForm
            vendors={vendorsRes.data ?? []}
            items={itemsRes.data ?? []}
            uoms={uomsRes.data ?? []}
          />
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-zinc-900">
            Recent Purchase Orders
          </h2>
          <div className="overflow-hidden rounded-xl bg-white shadow-sm">
            {recent.length === 0 ? (
              <p className="p-5 text-sm text-zinc-500">No purchase orders yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-left text-zinc-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">PO Number</th>
                    <th className="px-5 py-3 font-medium">Vendor</th>
                    <th className="px-5 py-3 font-medium">Date</th>
                    <th className="px-5 py-3 font-medium">Items</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((po) => (
                    <tr key={po.id} className={`border-t border-zinc-100 ${po.cancelled ? "bg-slate-100 text-zinc-400" : ""}`}>
                      <td className={`px-5 py-3 font-medium ${po.cancelled ? "text-zinc-400 line-through" : "text-zinc-900"}`}>
                        {po.po_number}
                      </td>
                      <td className="px-5 py-3 text-zinc-700">
                        {vendorName(po.vendors) ?? "—"}
                      </td>
                      <td className="px-5 py-3 text-zinc-700">{po.po_date}</td>
                      <td className="px-5 py-3 text-zinc-700">
                        {po.po_line_items?.length ?? 0}
                      </td>
                      <td className="px-5 py-3">
                        {po.cancelled ? (
                          <span className="rounded bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-600">Cancelled</span>
                        ) : (
                          <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Open</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <POActions poId={po.id} cancelled={po.cancelled} hasGRN={(po.grns?.length ?? 0) > 0} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
