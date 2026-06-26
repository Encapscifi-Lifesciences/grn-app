// Single source of truth for expiry windows, shared by the finance dashboard,
// the CSV export, and anywhere else that grades how soon stock expires.
// Windows match the warehouse inventory page: ≤30 / ≤60 / ≤90 days.

export const DAY = 86400000;

// Today at UTC midnight, so day-count math is stable regardless of server TZ.
export function todayUtc(): Date {
  return new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
}

// Whole days from `today` until the YYYY-MM-DD expiry date (negative = past).
export function daysToExpiry(
  expiry: string | null | undefined,
  today: Date = todayUtc()
): number | null {
  if (!expiry) return null;
  const t = new Date(expiry).getTime();
  if (Number.isNaN(t)) return null;
  return Math.round((t - today.getTime()) / DAY);
}

export type ExpiryLevel = "none" | "ok" | "d90" | "d60" | "d30" | "expired";

export function expiryLevel(dl: number | null): ExpiryLevel {
  if (dl === null) return "none";
  if (dl < 0) return "expired";
  if (dl <= 30) return "d30";
  if (dl <= 60) return "d60";
  if (dl <= 90) return "d90";
  return "ok";
}

// Plain-text label for CSV/Odoo export.
const CSV_LABEL: Record<ExpiryLevel, string> = {
  none: "",
  ok: "OK",
  d90: "Expiring ≤90d",
  d60: "Expiring ≤60d",
  d30: "Expiring ≤30d",
  expired: "Expired",
};

export function expiryStatusLabel(dl: number | null): string {
  return CSV_LABEL[expiryLevel(dl)];
}

// Colored pill for the UI; null = render nothing (no expiry tracked).
export const EXPIRY_BADGE: Record<ExpiryLevel, { text: string; cls: string } | null> = {
  none: null,
  ok: { text: "OK", cls: "bg-green-100 text-green-700" },
  d90: { text: "≤90 days", cls: "bg-yellow-100 text-yellow-800" },
  d60: { text: "≤60 days", cls: "bg-amber-100 text-amber-700" },
  d30: { text: "≤30 days", cls: "bg-red-100 text-red-700" },
  expired: { text: "Expired", cls: "bg-zinc-800 text-white" },
};
