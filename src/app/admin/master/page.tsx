import Link from "next/link";
import { requireRole, createServerSupabase } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { MasterManager } from "./MasterManager";

export const dynamic = "force-dynamic";

export default async function MasterDataPage() {
  const { user } = await requireRole(["admin"]);
  const supabase = await createServerSupabase();

  const [vendors, items, uoms] = await Promise.all([
    supabase.from("vendors").select("id, name").order("name"),
    supabase.from("items").select("id, name, description").order("name"),
    supabase.from("uoms").select("id, code, name").order("code"),
  ]);

  return (
    <div className="flex flex-1 flex-col bg-slate-50">
      <AppHeader title="Master Data" email={user.email} back />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-5 p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-500">
            Manage the dropdown lists used across the app. Entries in use can&apos;t be deleted.
          </p>
          <Link href="/admin" className="text-sm text-blue-600 underline">User Management →</Link>
        </div>

        <MasterManager kind="vendor" rows={(vendors.data ?? []) as never} />
        <MasterManager kind="item" rows={(items.data ?? []) as never} />
        <MasterManager kind="uom" rows={(uoms.data ?? []) as never} />
      </main>
    </div>
  );
}
