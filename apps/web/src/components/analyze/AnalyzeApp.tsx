"use client";
import { useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { putPending } from "@/lib/account/pending";
import { useUser } from "@/lib/account/useUser";
import type { Source } from "@bamanbirr/parser";
import { Report } from "@/components/report/Report";
import { runAnalysis, type RunOutput } from "@/lib/analysis/run";
import { STAGES, type InputFormat, type StageId } from "@/lib/analysis/protocol";

type Phase = "setup" | "running" | "done" | "error";
type StageState = Record<StageId, { done: number; total: number; note?: string; finished: boolean }>;

const SOURCE_INFO: Record<Source, { name: string; sub: string }> = {
  telebirr: { name: "telebirr", sub: "Messages from 127" },
  cbe: { name: "CBE", sub: "Commercial Bank of Ethiopia SMS" },
};

const FORMATS: { id: InputFormat; title: string; sub: string; badge?: string }[] = [
  { id: "pdf", title: "PDF export", sub: "From the Messages app on Mac or iPhone" },
  { id: "chatdb", title: "Mac messages database", sub: "chat.db — the most complete history", badge: "Most complete" },
  { id: "xml", title: "Android SMS backup", sub: "XML from “SMS Backup & Restore”" },
];

/** Turn low-level reader errors (pdf.js, SQLite) into something a person can act on. */
function friendlyError(msg: string): string {
  if (/Invalid PDF|PDF header|password/i.test(msg))
    return `This file couldn’t be opened as a PDF (${msg}). Export the conversation again with File → Print → Save as PDF.`;
  if (/not a database|file is encrypted|malformed/i.test(msg))
    return `This isn’t a readable messages database (${msg}). Choose chat.db from ~/Library/Messages.`;
  return msg;
}

export function AnalyzeApp() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [sources, setSources] = useState<Source[]>(["telebirr", "cbe"]);
  const [format, setFormat] = useState<InputFormat>("pdf");
  const [pdf, setPdf] = useState<Partial<Record<Source, File>>>({});
  const [dbFiles, setDbFiles] = useState<File[]>([]);
  const [xml, setXml] = useState<File | null>(null);
  const [stages, setStages] = useState<StageState | null>(null);
  const [out, setOut] = useState<RunOutput | null>(null);
  const [ran, setRan] = useState<Source[]>([]); // accounts the last analysis actually had input for
  const [error, setError] = useState("");

  const db = dbFiles.find((f) => f.name.endsWith(".db"));
  const wal = dbFiles.find((f) => f.name.endsWith("-wal")) ?? null;
  const ready =
    sources.length > 0 &&
    (format === "pdf" ? sources.some((s) => pdf[s]) : format === "chatdb" ? !!db : !!xml);

  const toggleSource = (s: Source) =>
    setSources((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s].sort()));

  async function start() {
    // With PDFs, only accounts that got a file take part; the other formats hold every account.
    const used = format === "pdf" ? sources.filter((s) => pdf[s]) : sources;
    setRan(used);
    const init = Object.fromEntries(STAGES.map((s) => [s.id, { done: 0, total: 1, finished: false }])) as StageState;
    if (!used.includes("cbe") || !used.includes("telebirr")) init.linking = { done: 1, total: 1, finished: true, note: "Only needed with both accounts" };
    setStages(init);
    setPhase("running");
    setError("");
    window.scrollTo({ top: 0 });
    try {
      const order = STAGES.map((s) => s.id);
      const res = await runAnalysis(
        { format, sources: used, files: { pdf, db, wal, xml: xml ?? undefined } },
        (stage, done, total, note) =>
          setStages((cur) => {
            if (!cur) return cur;
            const next = { ...cur };
            // everything before this stage is finished
            for (const id of order.slice(0, order.indexOf(stage))) next[id] = { ...next[id], done: next[id].total, finished: true };
            next[stage] = { done, total, note: note ?? cur[stage].note, finished: done >= total && stage !== "reading" ? true : done >= total };
            return next;
          }),
      );
      const txCount = used.reduce((n, s) => n + (res.result[s]?.transactions.length ?? 0), 0);
      if (!txCount) {
        const names = used.map((s) => SOURCE_INFO[s].name).join(" or ");
        throw new Error(`We didn’t find any ${names} transactions in this file. Check that you chose the right file and accounts, then try again.`);
      }
      setOut(res);
      setTimeout(() => setPhase("done"), 500);
    } catch (e) {
      setError(friendlyError(e instanceof Error ? e.message : String(e)));
      setPhase("error");
    }
  }

  if (phase === "done" && out) return <Done out={out} sources={ran} format={format} onRestart={() => { setPhase("setup"); setOut(null); }} />;
  if (phase === "running" || phase === "error")
    return <Running stages={stages!} error={phase === "error" ? error : ""} onBack={() => setPhase("setup")} />;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Analyze your messages</h1>
        <p className="mt-2 text-ink-2">Everything happens in this browser. Your file is never uploaded.</p>
      </div>

      <Step n={1} title="Which accounts?">
        <div className="grid gap-3 sm:grid-cols-2">
          {(["telebirr", "cbe"] as Source[]).map((s) => {
            const on = sources.includes(s);
            return (
              <button key={s} onClick={() => toggleSource(s)} aria-pressed={on}
                className={`flex items-center justify-between rounded-2xl border p-4 text-left transition ${on ? "border-brand-400 bg-brand-50 ring-2 ring-brand-200 dark:bg-brand-950 dark:ring-brand-800" : "border-line bg-surface hover:border-brand-300"}`}>
                <span>
                  <span className="block font-semibold">{SOURCE_INFO[s].name}</span>
                  <span className="block text-sm text-ink-2">{SOURCE_INFO[s].sub}</span>
                </span>
                <Check on={on} />
              </button>
            );
          })}
        </div>
        {sources.length === 2 && <p className="mt-3 text-[13px] text-ink-2">With both, transfers between CBE and telebirr are matched and labelled automatically.</p>}
        {sources.length === 0 && <p className="mt-3 text-[13px] text-out">Choose at least one account.</p>}
      </Step>

      <Step n={2} title="How will you add your messages?">
        <div className="grid gap-3 sm:grid-cols-3">
          {FORMATS.map((f) => (
            <button key={f.id} onClick={() => setFormat(f.id)} aria-pressed={format === f.id}
              className={`relative rounded-2xl border p-4 text-left transition ${format === f.id ? "border-brand-400 bg-brand-50 ring-2 ring-brand-200 dark:bg-brand-950 dark:ring-brand-800" : "border-line bg-surface hover:border-brand-300"}`}>
              {f.badge && <span className="absolute right-3 top-3 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold text-white">{f.badge}</span>}
              <span className="block pr-14 font-semibold">{f.title}</span>
              <span className="mt-1 block text-[13px] text-ink-2">{f.sub}</span>
            </button>
          ))}
        </div>
        <Guide format={format} />
      </Step>

      <Step n={3} title="Add your file">
        {format === "pdf" && (
          <div className="grid gap-3 sm:grid-cols-2">
            {sources.map((s) => (
              <Drop key={s} accept=".pdf,application/pdf" label={`${SOURCE_INFO[s].name} conversation PDF`}
                files={pdf[s] ? [pdf[s]!] : []} onFiles={(fs) => setPdf((cur) => ({ ...cur, [s]: fs[0] }))} />
            ))}
          </div>
        )}
        {format === "chatdb" && (
          <>
            <Drop multiple accept=".db,.db-wal,.db-shm" label="chat.db, chat.db-wal and chat.db-shm" files={dbFiles} onFiles={setDbFiles} />
            {dbFiles.length > 0 && !db && <p className="mt-2 text-[13px] text-out">Please include chat.db itself.</p>}
            {db && !wal && <p className="mt-2 text-[13px] text-warn">No chat.db-wal added — your newest messages may be missing. Add it if you have it.</p>}
          </>
        )}
        {format === "xml" && <Drop accept=".xml,text/xml" label="Your SMS backup (.xml)" files={xml ? [xml] : []} onFiles={(fs) => setXml(fs[0])} />}
        <button disabled={!ready} onClick={start}
          className="mt-5 w-full rounded-2xl bg-brand-600 px-6 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-line-strong disabled:shadow-none">
          Analyze
        </button>
        <p className="mt-3 text-center text-[12px] text-muted">Only telebirr (127) and CBE messages are read. Nothing leaves your device.</p>
      </Step>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
      <h2 className="flex items-center gap-3 text-lg font-semibold">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-[13px] text-white">{n}</span>{title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Check({ on }: { on: boolean }) {
  return (
    <span className={`flex h-6 w-6 items-center justify-center rounded-full border ${on ? "border-brand-600 bg-brand-600 text-white" : "border-line-strong"}`}>
      {on && <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="M4.5 10.5l3.5 3.5 7.5-8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
    </span>
  );
}

function Guide({ format }: { format: InputFormat }) {
  const steps: Record<InputFormat, ReactNode[]> = {
    pdf: [
      "Open the telebirr (127) or CBE conversation in the Messages app on your Mac.",
      <><b>Scroll all the way up</b> to the very first message — Messages only exports what has been loaded.</>,
      "Choose File → Print, then PDF → Save as PDF. Repeat for the other account.",
    ],
    chatdb: [
      "On your Mac, quit the Messages app (⌘Q).",
      <>In Finder press ⇧⌘G and go to <code className="rounded bg-surface-2 px-1">~/Library/Messages</code>.</>,
      <>Select <b>chat.db</b>, <b>chat.db-wal</b> and <b>chat.db-shm</b> and drop them below.</>,
    ],
    xml: [
      "Install “SMS Backup & Restore” on your Android phone.",
      "Back up your SMS (messages only) and save the .xml file.",
      "Copy the file to this device and drop it below.",
    ],
  };
  return (
    <div className="mt-4 rounded-2xl bg-surface-2/70 p-4">
      <ol className="space-y-2 text-[13px] text-ink-2">
        {steps[format].map((s, i) => (
          <li key={i} className="flex gap-2.5"><span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-semibold text-brand-700 dark:bg-brand-900 dark:text-brand-200">{i + 1}</span><span>{s}</span></li>
        ))}
      </ol>
      {format === "chatdb" && (
        <p className="mt-3 rounded-xl border border-brand-200 bg-surface p-3 text-[12.5px] text-ink-2 dark:border-brand-800">
          <b className="text-ink">About privacy:</b> chat.db contains <b>all</b> your messages, not just bank SMS. Bamanbirr reads it
          inside this browser and only looks at telebirr and CBE messages — the file is never uploaded. You can delete the copy
          afterwards.
        </p>
      )}
    </div>
  );
}

function Drop({ label, accept, files, onFiles, multiple }: { label: string; accept: string; files: File[]; onFiles: (f: File[]) => void; multiple?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files.length) onFiles([...e.dataTransfer.files]); }}
      onClick={() => ref.current?.click()} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") ref.current?.click(); }}
      className={`cursor-pointer rounded-2xl border-2 border-dashed p-5 text-center transition ${over ? "border-brand-500 bg-brand-50 dark:bg-brand-950" : files.length ? "border-brand-300 bg-brand-50/50 dark:bg-brand-950/40" : "border-line-strong hover:border-brand-400"}`}>
      <input ref={ref} type="file" className="hidden" accept={accept} multiple={multiple} onChange={(e) => e.target.files?.length && onFiles([...e.target.files])} />
      <p className="text-sm font-medium">{label}</p>
      {files.length ? (
        <ul className="mt-2 space-y-0.5 text-[13px] text-brand-700 dark:text-brand-200">
          {files.map((f) => <li key={f.name}>✓ {f.name} <span className="text-muted">({(f.size / 1048576).toFixed(1)} MB)</span></li>)}
        </ul>
      ) : (
        <p className="mt-1 text-[13px] text-muted">Drop here or click to choose</p>
      )}
    </div>
  );
}

function Running({ stages, error, onBack }: { stages: StageState; error: string; onBack: () => void }) {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="mx-auto max-w-xl rounded-3xl border border-line bg-surface p-6">
        <h1 className="text-xl font-semibold">{error ? "Something went wrong" : "Analyzing your messages…"}</h1>
        <p className="mt-1 text-[13px] text-ink-2">{error || "This runs on your device. Larger histories take a few seconds."}</p>
        <ul className="mt-5 space-y-4">
          {STAGES.map((s) => {
            const st = stages[s.id];
            const pct = st.finished ? 100 : Math.round((st.done / Math.max(1, st.total)) * 100);
            const active = !st.finished && (st.done > 0 || pct > 0);
            return (
              <li key={s.id}>
                <div className="flex items-center justify-between text-[13px]">
                  <span className={`flex items-center gap-2 ${st.finished ? "text-ink" : active ? "font-medium text-ink" : "text-muted"}`}>
                    <span className={`flex h-4 w-4 items-center justify-center rounded-full ${st.finished ? "bg-brand-600 text-white" : active ? "border-2 border-brand-500" : "border border-line-strong"}`}>
                      {st.finished && <svg viewBox="0 0 20 20" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="3"><path d="M4.5 10.5l3.5 3.5 7.5-8" /></svg>}
                    </span>
                    {s.label}
                  </span>
                  <span className="tabular text-[12px] text-muted">{st.note ?? (active ? `${pct}%` : "")}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all duration-300" style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
        {error && <button onClick={onBack} className="mt-6 rounded-full border border-line px-4 py-2 text-sm hover:border-brand-300">← Back</button>}
      </div>
      {!error && <Skeleton />}
    </div>
  );
}

function Skeleton() {
  return (
    <div aria-hidden className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="shimmer h-[86px] rounded-2xl" />)}
      </div>
      <div className="shimmer h-72 rounded-3xl" />
      <div className="grid gap-5 lg:grid-cols-2"><div className="shimmer h-64 rounded-3xl" /><div className="shimmer h-64 rounded-3xl" /></div>
    </div>
  );
}

function Done({ out, sources, format, onRestart }: { out: RunOutput; sources: Source[]; format: InputFormat; onRestart: () => void }) {
  const router = useRouter();
  const { user, configured } = useUser();
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    await putPending({ records: out.records, format, sources: sources.filter((s) => out.result[s]) });
    router.push(user ? "/reports/save" : "/signin?mode=signup&next=/reports/save");
  }
  const missing = sources.filter((s) => !out.result[s]);
  const msgs = (s: Source) => Object.values(out.result[s]?.counts ?? {}).reduce((a, b) => a + b, 0);
  return (
    <div className="animate-fade-up space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-brand-200 bg-gradient-to-r from-brand-50 to-surface p-5 dark:border-brand-800 dark:from-brand-950">
        <div>
          <p className="font-semibold">Your report is ready</p>
          <p className="text-[13px] text-ink-2">
            Read {sources.map((s) => `${msgs(s).toLocaleString("en-US")} ${SOURCE_INFO[s].name}`).join(" and ")} messages.
            {missing.length > 0 && ` No ${missing.map((s) => SOURCE_INFO[s].name).join(" or ")} messages were found in this file.`}
            {" "}{user ? "Save it to your account to reopen it any time." : "This report is shown once — create a free account to save it."}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={onRestart} className="rounded-full border border-line bg-surface px-4 py-2 text-sm hover:border-brand-300">New analysis</button>
          <button onClick={save} disabled={!configured || saving} title={configured ? undefined : "Accounts aren’t connected yet"}
            className="rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700 disabled:opacity-60">
            {saving ? "Saving…" : "Save report"}
          </button>
        </div>
      </div>
      <Report result={out.result} />
    </div>
  );
}
