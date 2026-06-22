import { requireRole, createServerSupabase } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import POForm from "./POForm";

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
      .select("id,po_number,po_date,vendors(name),po_line_items(id)")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const recent = (posRes.data ?? []) as Array<{
    id: string;
    po_number: string;
    po_date: string;
    vendors: { name: string } | { name: string }[] | null;
    po_line_items: { id: string }[];
  }>;

  const vendorName = (v: (typeof recent)[number]["vendors"]) =>
    Array.isArray(v) ? v[0]?.name : v?.name;

  return (
    <div className="flex flex-1 flex-col bg-zinc-100">
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
                <thead className="bg-zinc-50 text-left text-zinc-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">PO Number</th>
                    <th className="px-5 py-3 font-medium">Vendor</th>
                    <th className="px-5 py-3 font-medium">Date</th>
                    <th className="px-5 py-3 font-medium">Items</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((po) => (
                    <tr key={po.id} className="border-t border-zinc-100">
                      <td className="px-5 py-3 font-medium text-zinc-900">
                        {po.po_number}
                      </td>
                      <td className="px-5 py-3 text-zinc-700">
                        {vendorName(po.vendors) ?? "—"}
                      </td>
                      <td className="px-5 py-3 text-zinc-700">{po.po_date}</td>
                      <td className="px-5 py-3 text-zinc-700">
                        {po.po_line_items?.length ?? 0}
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
