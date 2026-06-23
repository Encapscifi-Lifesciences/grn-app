import Link from "next/link";
import { requireRole } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import GRNForm from "./GRNForm";

export const dynamic = "force-dynamic";

export default async function WarehousePage() {
  const { user } = await requireRole(["warehouse"]);
  return (
    <div className="flex flex-1 flex-col bg-slate-50">
      <AppHeader title="Warehouse · New GRN" email={user.email} back />
      <main className="mx-auto w-full max-w-3xl flex-1 p-4 sm:p-6">
        <div className="mb-4 flex justify-end">
          <Link href="/warehouse/inventory" className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 shadow-sm hover:bg-slate-50">
            View Inventory →
          </Link>
        </div>
        <GRNForm />
      </main>
    </div>
  );
}
