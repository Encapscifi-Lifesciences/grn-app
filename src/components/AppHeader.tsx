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
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
      <div className="flex items-center gap-3">
        {back && (
          <Link
            href="/"
            className="text-sm text-slate-500 hover:text-teal-700"
            aria-label="Back to home"
          >
            ← Home
          </Link>
        )}
        <Link href="/" className="flex items-center gap-2.5" aria-label="Home">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 text-sm font-bold text-white shadow-sm">
            E
          </span>
          <h1 className="text-base font-semibold text-slate-900">{title}</h1>
        </Link>
      </div>
      <form action="/auth/signout" method="post" className="flex items-center gap-3">
        {email && (
          <span className="hidden text-sm text-slate-500 sm:inline">{email}</span>
        )}
        <button
          type="submit"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700"
        >
          Sign out
        </button>
      </form>
    </header>
  );
}
