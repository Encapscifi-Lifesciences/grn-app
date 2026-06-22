import Link from "next/link";

// Shared top bar for authenticated pages. Includes the sign-out form.
export function AppHeader({
  title,
  email,
  back,
}: {
  title: string;
  email?: string;
  back?: boolean;
}) {
  return (
    <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 sm:px-6">
      <div className="flex items-center gap-3">
        {back && (
          <Link
            href="/"
            className="text-sm text-zinc-500 hover:text-zinc-900"
            aria-label="Back to home"
          >
            ← Home
          </Link>
        )}
        <h1 className="text-base font-semibold text-zinc-900">{title}</h1>
      </div>
      <form action="/auth/signout" method="post" className="flex items-center gap-3">
        {email && (
          <span className="hidden text-sm text-zinc-500 sm:inline">{email}</span>
        )}
        <button
          type="submit"
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Sign out
        </button>
      </form>
    </header>
  );
}
