"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Report } from "@/components/report/Report";
import { getRun, type RunRow } from "@/lib/account/store";
import { useRequireUser, useUser } from "@/lib/account/useUser";
import type { AnalysisResult } from "@bamanbirr/parser";

/** Opens one saved version of a report. */
export function RunView() {
  const { id } = useParams<{ id: string }>();
  const same = useSearchParams().get("same") === "1";
  const { sb, user, configured } = useUser();
  const [run, setRun] = useState<(RunRow & { result: AnalysisResult }) | null>(null);
  const [error, setError] = useState("");

  useRequireUser(user, configured, `/reports/${id}`);

  useEffect(() => {
    if (!user || !sb) return;
    getRun(sb, id).then(setRun).catch((e: { code?: string; message?: string }) =>
      // PGRST116: no row visible (missing, deleted or another account's); 22P02: not a valid id.
      setError(e.code === "PGRST116" || e.code === "22P02"
        ? "This report doesn’t exist, or it belongs to another account."
        : e.message ?? "Couldn’t open this report."));
  }, [user, sb, id]);

  if (!configured) return <p className="text-center text-sm text-ink-2">Accounts aren’t connected yet — add your Supabase keys to <code>apps/web/.env</code>.</p>;
  if (error) return <p className="rounded-xl bg-out/10 px-3 py-2 text-[13px] text-out">{error} <Link href="/reports" className="underline">Back to my reports</Link></p>;
  if (!run) return (
    <div className="space-y-5">
      <div className="shimmer h-20 rounded-3xl" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }, (_, i) => <div key={i} className="shimmer h-[86px] rounded-2xl" />)}</div>
      <div className="shimmer h-72 rounded-3xl" />
    </div>
  );
  return (
    <div className="animate-fade-up space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-line bg-surface p-5">
        <div>
          <Link href="/reports" className="text-[13px] text-brand-600 hover:underline">← My reports</Link>
          <p className="mt-1 font-semibold">Version {run.version} · saved {new Date(run.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
          <p className="text-[13px] text-ink-2">
            {run.message_count.toLocaleString("en-US")} messages · {run.date_from} → {run.date_to} · analyzer v{run.parser_version}
            {same && " · Nothing changed since this version, so it was reused instead of saving a copy."}
          </p>
        </div>
        <Link href="/analyze" className="rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700">Add messages</Link>
      </div>
      <Report result={run.result} />
    </div>
  );
}
