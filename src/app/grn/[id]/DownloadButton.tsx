"use client";

export function DownloadButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
    >
      ⬇ Download PDF
    </button>
  );
}
