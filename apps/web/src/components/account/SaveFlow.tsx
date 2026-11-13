"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Source } from "@bamanbirr/parser";
import { clearPending, getPending } from "@/lib/account/pending";
import { createRun, loadLabels, loadMessages, saveMessages } from "@/lib/account/store";
import { useRequireUser, useUser } from "@/lib/account/useUser";
import { analyzeRecords } from "@/lib/analysis/run";

const STEPS = ["Saving your telebirr and CBE messages", "Combining with what you saved before", "Analyzing your full history", "Saving this version"];

/** Finishes "Save report": store messages, re-analyse everything saved, store a new version. */
export function SaveFlow() {
  const { sb, user, configured } = useUser();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [nothing, setNothing] = useState(false);
  const started = useRef(false);
  useRequireUser(user, configured, "/reports/save");

  useEffect(() => {
    if (!user || !sb || started.current) return;
    started.current = true;
    (async () => {
      try {
        const pending = await getPending();
        if (!pending) { setNothing(true); return; }
        setStep(0);
        const added = await saveMessages(sb, pending.records, pending.format, pending.sources);
        setNote(`${added.toLocaleString("en-US")} new messages saved`);
        setStep(1);
        const [all, labels] = await Promise.all([loadMessages(sb), loadLabels(sb)]);
        setNote(`${all.length.toLocaleString("en-US")} messages in your account`);
        setStep(2);
        const sources = [...new Set(all.map((r) => r.source))] as Source[];
        const out = await analyzeRecords(all, sources, labels, () => {});
        setStep(3);
        const run = await createRun(sb, all, out.result);
        await clearPending();
        router.replace(`/reports/${run.id}${run.reused ? "?same=1" : ""}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e));
      }
    })();
  }, [user, sb, router]);

  if (!configured) return <Box title="Accounts aren’t connected yet"><p className="text-sm text-ink-2">Add your Supabase keys to <code>apps/web/.env</code> and restart the app.</p></Box>;
  if (nothing) {
    return (
      <Box title="Nothing to save">
        <p className="text-sm text-ink-2">There’s no unsaved report in this browser. Run a new analysis and press “Save report”.</p>
        <a href="/analyze" className="mt-4 inline-block rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white">New analysis</a>
      </Box>
    );
  }
  return (
    <Box title={error ? "We couldn’t save your report" : "Saving your report…"}>
      {error ? (
        <p className="rounded-xl bg-out/10 px-3 py-2 text-[13px] text-out">{error}</p>
      ) : (
        <ul className="space-y-3">
          {STEPS.map((s, i) => (
            <li key={s} className={`flex items-center gap-2.5 text-[14px] ${i <= step ? "text-ink" : "text-muted"}`}>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full ${i < step ? "bg-brand-600 text-white" : i === step ? "border-2 border-brand-500" : "border border-line-strong"}`}>
                {i < step && <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3"><path d="M4.5 10.5l3.5 3.5 7.5-8" /></svg>}
              </span>
              {s}
              {i === step && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" />}
            </li>
          ))}
        </ul>
      )}
      {note && !error && <p className="mt-4 text-[13px] text-muted">{note}</p>}
    </Box>
  );
}

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md rounded-3xl border border-line bg-surface p-6 shadow-xl shadow-brand-900/5">
      <h1 className="mb-4 text-xl font-semibold">{title}</h1>
      {children}
    </div>
  );
}
