"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PARSER_VERSION, type Source } from "@bamanbirr/parser";
import { countMessages, createRun, deleteAllData, deleteRun, listRuns, loadLabels, loadMessages, type RunRow } from "@/lib/account/store";
import { useRequireUser, useUser } from "@/lib/account/useUser";
import { analyzeRecords } from "@/lib/analysis/run";
import { fmt } from "@/lib/report/model";

const NAMES: Record<string, string> = { telebirr: "telebirr", cbe: "CBE" };
const when = (s: string) => new Date(s).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function ReportsHome() {
  const { sb, user, configured } = useUser();
  const router = useRouter();
  const [runs, setRuns] = useState<RunRow[] | null>(null);
  const [counts, setCounts] = useState<Record<Source, number> | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const leaving = useRef(false); // set while "Delete my account" signs out and navigates
  useRequireUser(user, configured, "/reports", leaving);

  const refresh = useCallback(async () => {
    if (!sb) return;
    try {
      const [r, c] = await Promise.all([listRuns(sb), countMessages(sb)]);
      setRuns(r); setCounts(c);
    } catch (e) { setError((e as Error).message); }
  }, [sb]);

  useEffect(() => {
    if (!user || !sb) return;
    let live = true;
    Promise.all([listRuns(sb), countMessages(sb)]).then(
      ([r, c]) => { if (live) { setRuns(r); setCounts(c); } },
      (e: Error) => { if (live) setError(e.message); },
    );
    return () => { live = false; };
  }, [user, sb]);

  async function rerun() {
    if (!sb) return;
    setBusy("rerun"); setError("");
    try {
      const all = await loadMessages(sb);
      if (!all.length) throw new Error("There are no saved messages yet.");
      const out = await analyzeRecords(all, [...new Set(all.map((r) => r.source))] as Source[], await loadLabels(sb), () => {});
      const run = await createRun(sb, all, out.result);
      router.push(`/reports/${run.id}${run.reused ? "?same=1" : ""}`);
    } catch (e) { setError((e as Error).message); setBusy(""); }
  }

  async function remove(id: string, version: number) {
    if (!sb || !confirm(`Delete version ${version}? This can’t be undone.`)) return;
    setBusy(id);
    try { await deleteRun(sb, id); await refresh(); } catch (e) { setError((e as Error).message); }
    setBusy("");
  }

  async function wipe() {
    if (!sb || !user || !confirm("Delete ALL your saved messages and reports? This can’t be undone. Your account stays, empty.")) return;
    setBusy("wipe");
    try { await deleteAllData(sb, user.id); await refresh(); } catch (e) { setError((e as Error).message); }
    setBusy("");
  }

  async function closeAccount() {
    if (!sb || !confirm("Delete your account and everything in it? This can’t be undone.")) return;
    setBusy("close"); setError("");
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Couldn’t delete the account.");
      leaving.current = true;
      await sb.auth.signOut();
      router.replace("/?deleted=1");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t delete the account."); setBusy("");
    }
  }

  if (!configured) return <p className="text-center text-sm text-ink-2">Accounts aren’t connected yet — add your Supabase keys to <code>apps/web/.env</code>.</p>;
  if (!user || runs === null) return <div className="space-y-4">{[0, 1, 2].map((i) => <div key={i} className="shimmer h-28 rounded-3xl" />)}</div>;

  const total = (counts?.telebirr ?? 0) + (counts?.cbe ?? 0);
  const latest = runs[0];
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">My reports</h1>
            <p className="mt-1 text-sm text-ink-2">Every save or re-run creates a new version. Older versions stay as they were.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={rerun} disabled={!!busy || !total}
              className="rounded-full border border-line bg-surface px-4 py-2 text-sm hover:border-brand-300 disabled:opacity-50">
              {busy === "rerun" ? "Re-running…" : "Re-run analysis"}
            </button>
            <Link href="/analyze" className="rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700">Add messages</Link>
          </div>
        </div>
        {error && <p className="rounded-xl bg-out/10 px-3 py-2 text-[13px] text-out">{error}</p>}
        {latest && latest.parser_version !== PARSER_VERSION && (
          <p className="rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-[13px] text-brand-800 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-200">
            The analyzer has improved since your latest version. Use “Re-run analysis” to get an updated report — no need to upload again.
          </p>
        )}
        {runs.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-line-strong bg-surface p-10 text-center">
            <p className="font-semibold">No saved reports yet</p>
            <p className="mt-1 text-sm text-ink-2">Analyze your messages and press “Save report”.</p>
            <Link href="/analyze" className="mt-4 inline-block rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white">Analyze my messages</Link>
          </div>
        ) : runs.map((r, i) => (
          <article key={r.id} className={`rounded-3xl border bg-surface p-5 transition hover:border-brand-300 ${i === 0 ? "border-brand-300 shadow-lg shadow-brand-900/5" : "border-line"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">Version {r.version}</h2>
                  {i === 0 && <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-semibold text-white">Latest</span>}
                </div>
                <p className="mt-0.5 text-[13px] text-ink-2">
                  Saved {when(r.created_at)} · {r.message_count.toLocaleString("en-US")} messages · {r.date_from} → {r.date_to} · analyzer v{r.parser_version}
                </p>
              </div>
              <div className="flex gap-2">
                <Link href={`/reports/${r.id}`} className="rounded-full bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100 dark:bg-brand-950 dark:text-brand-200">Open</Link>
                <button onClick={() => remove(r.id, r.version)} disabled={!!busy} className="rounded-full px-3 py-1.5 text-sm text-muted hover:text-out">Delete</button>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {Object.entries(r.summary).map(([src, s]) => (
                <div key={src} className="rounded-2xl bg-surface-2/70 p-3">
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">{NAMES[src] ?? src} · {s.transactions.toLocaleString("en-US")} transactions</p>
                  <div className="mt-1.5 grid grid-cols-3 gap-2 tabular text-[13px]">
                    <span><span className="block text-[11px] text-muted">In</span><span className="text-in">{fmt(s.moneyIn)}</span></span>
                    <span><span className="block text-[11px] text-muted">Out</span><span className="text-out">{fmt(s.moneyOut)}</span></span>
                    <span><span className="block text-[11px] text-muted">Balance</span>{s.closing != null ? fmt(s.closing) : "–"}</span>
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>

      <aside className="space-y-4">
        <div className="rounded-3xl border border-line bg-surface p-5">
          <h2 className="font-semibold">Your data</h2>
          <p className="mt-1 text-[13px] text-ink-2">{user.email}</p>
          <dl className="mt-4 space-y-2 text-[13px] tabular">
            <div className="flex justify-between"><dt className="text-ink-2">telebirr messages</dt><dd>{(counts?.telebirr ?? 0).toLocaleString("en-US")}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-2">CBE messages</dt><dd>{(counts?.cbe ?? 0).toLocaleString("en-US")}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-2">Report versions</dt><dd>{runs.length}</dd></div>
          </dl>
          <p className="mt-4 text-[12px] leading-relaxed text-muted">
            We store only telebirr and CBE message text — never your PDF or messages database — so you can re-run reports without uploading again.
          </p>
        </div>
        <div className="rounded-3xl border border-line bg-surface p-5">
          <h2 className="font-semibold">Delete</h2>
          <button onClick={wipe} disabled={!!busy} className="mt-3 w-full rounded-xl border border-line px-3 py-2 text-left text-[13px] hover:border-out/50 hover:text-out">
            {busy === "wipe" ? "Deleting…" : "Delete all saved messages and reports"}
          </button>
          <button onClick={closeAccount} disabled={!!busy} className="mt-2 w-full rounded-xl border border-line px-3 py-2 text-left text-[13px] hover:border-out/50 hover:text-out">
            {busy === "close" ? "Deleting…" : "Delete my account"}
          </button>
        </div>
      </aside>
    </div>
  );
}
