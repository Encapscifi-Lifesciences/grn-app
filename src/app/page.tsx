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
  emoji: string;
  accent: string; // tailwind classes for the icon tile
}[] = [
  {
    role: "purchase",
    href: "/purchase",
    title: "Purchase Portal",
    desc: "Log purchase orders with multiple line items, or upload a PO PDF.",
    emoji: "🛒",
    accent: "bg-teal-50 text-teal-600 ring-teal-100",
  },
  {
    role: "warehouse",
    href: "/warehouse",
    title: "Warehouse Portal",
    desc: "Generate GRNs when goods arrive, with batch, expiry and photo proof.",
    emoji: "📦",
    accent: "bg-emerald-50 text-emerald-600 ring-emerald-100",
  },
  {
    role: "warehouse",
    href: "/warehouse/inventory",
    title: "Inventory",
    desc: "Track received raw materials, view stock, and mark expired items.",
    emoji: "📊",
    accent: "bg-cyan-50 text-cyan-600 ring-cyan-100",
  },
  {
    role: "finance",
    href: "/finance",
    title: "Finance Portal",
    desc: "Review GRNs, set reconciliation status, and export for Odoo.",
    emoji: "💰",
    accent: "bg-sky-50 text-sky-600 ring-sky-100",
  },
  {
    role: "admin",
    href: "/admin",
    title: "User Management",
    desc: "Add team members and assign Purchase / Warehouse / Finance roles.",
    emoji: "👥",
    accent: "bg-indigo-50 text-indigo-600 ring-indigo-100",
  },
  {
    role: "admin",
    href: "/admin/master",
    title: "Master Data",
    desc: "Manage Vendors, Items and Units of Measure used across the app.",
    emoji: "🗂️",
    accent: "bg-violet-50 text-violet-600 ring-violet-100",
  },
];

// Warehouse / logistics hero photo (loaded via plain CSS background, no next/image config needed).
const HERO_IMG =
  "https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&w=1600&q=80";

export default async function Home() {
  const { user, role } = await getSessionRole();
  if (!user) redirect("/login");

  const visible = PORTALS.filter((p) => role === "admin" || role === p.role);

  return (
    <div className="flex flex-1 flex-col bg-slate-50">
      <AppHeader title="Encapscifi GRN" email={user.email} />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        {/* Hero banner with background image + gradient overlay */}
        <section
          className="relative overflow-hidden rounded-2xl shadow-sm ring-1 ring-black/5"
          style={{ backgroundImage: `url("${HERO_IMG}")`, backgroundSize: "cover", backgroundPosition: "center" }}
        >
          <div className="bg-gradient-to-br from-slate-900/90 via-teal-900/80 to-emerald-900/70 px-6 py-10 sm:px-10 sm:py-12">
            <div className="flex items-center gap-2 text-sm font-medium text-teal-200">
              <span>💊</span>
              <span>Encapscifi · Nutraceutical Manufacturing</span>
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Goods Received Note Management
            </h1>
            <p className="mt-2 max-w-xl text-sm text-zinc-200 sm:text-base">
              Track purchase orders, log incoming goods with batch &amp; expiry
              proof, and reconcile everything for Odoo — all in one place.
            </p>
            <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white ring-1 ring-white/20 backdrop-blur">
              👤 {user.email}
              <span className="rounded-full bg-white/20 px-2 py-0.5 uppercase tracking-wide">
                {role ?? "no role"}
              </span>
            </p>
          </div>
        </section>

        {/* Sections as a clean vertical list */}
        <h2 className="mb-3 mt-8 px-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Your Workspaces
        </h2>

        {visible.length === 0 ? (
          <div className="rounded-xl bg-white p-6 text-zinc-600 shadow-sm ring-1 ring-zinc-100">
            🔒 Your account has no portal access yet. Ask an administrator to set
            your role.
          </div>
        ) : (
          <ul className="space-y-3">
            {visible.map((p) => (
              <li key={p.href}>
                <Link
                  href={p.href}
                  className="group flex items-center gap-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition-all hover:shadow-md hover:ring-teal-300 sm:p-5"
                >
                  <span
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl ring-1 ${p.accent}`}
                  >
                    {p.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-semibold text-zinc-900">
                      {p.title}
                    </span>
                    <span className="mt-0.5 block text-sm text-zinc-500">
                      {p.desc}
                    </span>
                  </span>
                  <span className="shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-teal-600">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-10 text-center text-xs text-zinc-400">
          🏭 Encapscifi GRN · Bangalore · Secure internal system
        </p>
      </main>
    </div>
  );
}
