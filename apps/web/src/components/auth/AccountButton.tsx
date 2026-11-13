"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/account/useUser";

/** Header control: "Sign in" when signed out; an account menu when signed in. */
export function AccountButton() {
  const { sb, user, configured } = useUser();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  if (!configured || user === undefined) return null;
  if (!user) return <Link href="/signin" className="whitespace-nowrap py-2 text-sm font-medium text-ink-2 hover:text-ink">Sign in</Link>;
  const initial = (user.email ?? "?").charAt(0).toUpperCase();
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Account menu"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700 ring-2 ring-transparent hover:ring-brand-200 dark:bg-brand-900 dark:text-brand-100">
        {initial}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-40 w-60 rounded-2xl border border-line bg-surface p-1.5 text-sm shadow-2xl shadow-brand-900/15">
          <p className="truncate px-3 py-2 text-[12px] text-muted">{user.email}</p>
          <Link href="/reports" onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2 hover:bg-wash">My reports</Link>
          <Link href="/analyze" onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2 hover:bg-wash">New analysis</Link>
          <button onClick={async () => { await sb?.auth.signOut(); setOpen(false); router.push("/"); router.refresh(); }}
            className="block w-full rounded-xl px-3 py-2 text-left text-ink-2 hover:bg-wash">Sign out</button>
        </div>
      )}
    </div>
  );
}
