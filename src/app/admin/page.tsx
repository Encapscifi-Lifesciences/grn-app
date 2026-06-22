import { requireRole, createServerSupabase } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { RoleSelect } from "./RoleSelect";
import { AddUserForm } from "./AddUserForm";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { user } = await requireRole(["admin"]);
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("list_profiles");
  const users = (data ?? []) as { id: string; email: string; role: string }[];

  return (
    <div className="flex flex-1 flex-col bg-zinc-100">
      <AppHeader title="User Management" email={user.email} back />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 p-4 sm:p-6">
        <AddUserForm />

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error.message}
          </p>
        )}

        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Current Role</th>
                <th className="px-4 py-3 font-medium">Change Role</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-4 text-zinc-500">No users found.</td></tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="border-t border-zinc-100">
                    <td className="px-4 py-3 font-medium text-zinc-900">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium uppercase tracking-wide">
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <RoleSelect userId={u.id} current={u.role} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
