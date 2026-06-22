import { requireRole } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";

export const dynamic = "force-dynamic";

export default async function WarehousePage() {
  const { user } = await requireRole(["warehouse"]);
  return (
    <div className="flex flex-1 flex-col bg-zinc-100">
      <AppHeader title="Warehouse Portal" email={user.email} back />
      <main className="mx-auto w-full max-w-5xl flex-1 p-6">
        <div className="rounded-xl bg-white p-8 text-center text-zinc-500 shadow-sm">
          GRN generation form — coming in the next step.
        </div>
      </main>
    </div>
  );
}
