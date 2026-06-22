import { requireRole } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import GRNForm from "./GRNForm";

export const dynamic = "force-dynamic";

export default async function WarehousePage() {
  const { user } = await requireRole(["warehouse"]);
  return (
    <div className="flex flex-1 flex-col bg-zinc-100">
      <AppHeader title="Warehouse · New GRN" email={user.email} back />
      <main className="mx-auto w-full max-w-3xl flex-1 p-4 sm:p-6">
        <GRNForm />
      </main>
    </div>
  );
}
