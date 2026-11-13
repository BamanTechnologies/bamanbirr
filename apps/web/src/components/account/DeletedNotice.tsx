"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";

/** Confirmation shown on the home page after "Delete my account" (/?deleted=1). */
export function DeletedNotice() {
  const deleted = useSearchParams().get("deleted") === "1";
  const [open, setOpen] = useState(true);
  if (!deleted || !open) return null;
  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
      <div role="status" className="flex items-start justify-between gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-[14px] text-brand-800 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-200">
        <p><b>Your account was deleted.</b> Your saved messages and reports were deleted with it.</p>
        <button onClick={() => setOpen(false)} aria-label="Dismiss" className="shrink-0 rounded-full px-1.5 text-brand-700 hover:text-ink dark:text-brand-200">✕</button>
      </div>
    </div>
  );
}
