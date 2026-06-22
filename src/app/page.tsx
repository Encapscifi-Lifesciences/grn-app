import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionRole, type Role } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";

export const dynamic = "force-dynamic";

const PORTALS: {
  role: Role;
  href: string;
  title: string;
  desc: string;
}[] = [
  {
    role: "purchase",
    href: "/purchase",
    title: "Purchase Portal",
    desc: "Log purchase orders with multiple line items, or upload a PO PDF.",
  },
  {
    role: "warehouse",
    href: "/warehouse",
    title: "Warehouse Portal",
    desc: "Generate GRNs when goods arrive, with batch, expiry and photo proof.",
  },
  {
    role: "warehouse",
    href: "/warehouse/inventory",
    title: "Inventory",
    desc: "Track received raw materials, view stock, and mark expired items.",
  },
  {
    role: "finance",
    href: "/finance",
    title: "Finance Portal",
    desc: "Review GRNs, set reconciliation status, and export for Odoo.",
  },
];

export default async function Home() {
  const { user, role } = await getSessionRole();
  if (!user) redirect("/login");

  const visible = PORTALS.filter((p) => role === "admin" || role === p.role);

  return (
    <div className="flex flex-1 flex-col bg-zinc-100">
      <AppHeader title="Encapscifi GRN" email={user.email} />
      <main className="mx-auto w-full max-w-4xl flex-1 p-6">
        <p className="mb-6 text-sm text-zinc-500">
          Signed in as <span className="font-medium">{user.email}</span> ·{" "}
          <span className="rounded bg-zinc-200 px-2 py-0.5 font-medium uppercase tracking-wide">
            {role ?? "no role"}
          </span>
        </p>

        {visible.length === 0 ? (
          <div className="rounded-xl bg-white p-6 text-zinc-600 shadow-sm">
            Your account has no portal access yet. Ask an administrator to set
            your role.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((p) => (
              <Link
                key={p.href}
                href={p.href}
                className="rounded-xl bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <h2 className="text-lg font-semibold text-zinc-900">
                  {p.title}
                </h2>
                <p className="mt-2 text-sm text-zinc-500">{p.desc}</p>
                <span className="mt-4 inline-block text-sm font-medium text-zinc-900">
                  Open →
                </span>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
