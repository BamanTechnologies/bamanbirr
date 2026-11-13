import Link from "next/link";
import { Suspense } from "react";
import { DeletedNotice } from "@/components/account/DeletedNotice";
import { SiteFooter, SiteHeader } from "@/components/brand";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Suspense fallback={null}><DeletedNotice /></Suspense>
        <Hero />
        <TrustStrip />
        <HowItWorks />
        <Features />
        <Privacy />
        <Formats />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}

/* ---------------------------------------------------------------- hero */
function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 h-[560px] w-[1100px] -translate-x-1/2 rounded-full bg-gradient-to-b from-brand-200/70 via-brand-100/40 to-transparent blur-3xl dark:from-brand-800/30 dark:via-brand-900/20" />
      </div>
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-14 sm:px-6 md:pt-20 lg:grid-cols-[1.05fr_1fr]">
        <div className="animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-200">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" /> Free · Private · No sign-up needed
          </span>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
            Every birr,
            <br />
            <span className="bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent">accounted for.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-ink-2">
            Bamanbirr turns your telebirr and CBE SMS history into a clear money report — where it came from, where it
            went, who you pay most, and whether every balance adds up.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/analyze"
              className="rounded-full bg-brand-600 px-6 py-3 text-[15px] font-medium text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-700"
            >
              Analyze my messages
            </Link>
            <Link href="/#how" className="rounded-full border border-line-strong bg-surface px-6 py-3 text-[15px] font-medium text-ink transition hover:border-brand-300">
              See how it works
            </Link>
          </div>
          <p className="mt-5 text-sm text-muted">
            Works with telebirr (127) and CBE messages · PDF export, Mac/iPhone messages database, Android SMS backup
          </p>
        </div>
        <ProductPreview />
      </div>
    </section>
  );
}

/** A static preview of the report, with sample data. */
function ProductPreview() {
  const bars = [
    [42, 30], [65, 48], [38, 52], [80, 61], [55, 40], [92, 70], [60, 77], [72, 50], [48, 44], [85, 66], [58, 49], [70, 58],
  ];
  return (
    <div className="relative animate-fade-up [animation-delay:120ms]">
      <div className="rounded-3xl border border-line bg-surface p-5 shadow-2xl shadow-brand-900/10 sm:pb-14">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted">telebirr · last 12 months</p>
            <p className="mt-1 text-sm text-ink-2">Sample report</p>
          </div>
          <div className="flex gap-1 rounded-full bg-surface-2 p-1 text-xs">
            <span className="rounded-full bg-surface px-3 py-1 font-medium shadow-sm">telebirr</span>
            <span className="px-3 py-1 text-muted">CBE</span>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[["Money in", "184,250.00", "in"], ["Money out", "176,930.40", "out"], ["Balance", "7,319.60", "ink"]].map(([l, v, c]) => (
            <div key={l} className="rounded-2xl border border-line bg-surface-2/60 p-3">
              <p className="text-[11px] text-muted">{l}</p>
              <p className={`tabular mt-1 text-[15px] font-semibold ${c === "in" ? "text-in" : c === "out" ? "text-out" : "text-ink"}`}>{v}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-2xl border border-line p-3">
          <div className="mb-2 flex items-center gap-4 text-[11px] text-muted">
            <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-in" />In</span>
            <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-out" />Out</span>
          </div>
          <svg viewBox="0 0 360 120" className="w-full" role="img" aria-label="Sample chart of money in and out per month">
            <line x1="0" x2="360" y1="60" y2="60" stroke="var(--line-strong)" />
            {bars.map(([i, o], k) => (
              <g key={k}>
                <rect x={8 + k * 29.5} y={59 - i * 0.6} width="10" height={i * 0.6} rx="3" fill="var(--in)" />
                <rect x={20 + k * 29.5} y={61} width="10" height={o * 0.6} rx="3" fill="var(--out)" />
              </g>
            ))}
          </svg>
        </div>
        <div className="mt-4 space-y-2">
          {[["Abebe K.", 84, "21,400"], ["Supermarket", 61, "15,620"], ["Fuel station", 43, "11,050"]].map(([n, w, v]) => (
            <div key={n as string} className="flex items-center gap-3 text-xs">
              <span className="w-24 shrink-0 text-ink-2">{n}</span>
              <span className="h-2.5 rounded-full bg-out/85" style={{ width: `${w}%` }} />
              <span className="tabular text-ink">{v}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute -bottom-5 -left-4 hidden rounded-2xl border border-line bg-surface px-4 py-3 shadow-xl sm:block">
        <p className="text-[11px] text-muted">Balance check</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-good">
          <CheckIcon /> 1,204 of 1,206 balances match
        </p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- strips */
function TrustStrip() {
  const items = [
    ["Runs on your device", "Your messages are read in your browser. Nothing is uploaded unless you choose to save."],
    ["Every balance checked", "Each SMS states your new balance — we verify every one and show any gaps."],
    ["Receipts one click away", "Open the official telebirr or CBE receipt for any transaction."],
  ];
  return (
    <section className="border-y border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:px-6 md:grid-cols-3">
        {items.map(([t, d]) => (
          <div key={t} className="flex gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-200">
              <CheckIcon />
            </span>
            <div>
              <p className="font-medium">{t}</p>
              <p className="mt-1 text-sm text-ink-2">{d}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SectionTitle({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
      {sub && <p className="mt-3 text-ink-2">{sub}</p>}
    </div>
  );
}

function HowItWorks() {
  const steps = [
    ["1", "Choose your accounts", "telebirr, CBE, or both. Using both links transfers between them automatically."],
    ["2", "Add your messages", "Upload a PDF export, your Mac messages database, or an Android SMS backup. We guide you step by step."],
    ["3", "Get your report", "In seconds: totals, trends, people, times, receipts and a full balance check — with rich filters."],
  ];
  return (
    <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
      <SectionTitle eyebrow="How it works" title="From SMS to clarity in three steps" />
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {steps.map(([n, t, d]) => (
          <div key={n} className="rounded-3xl border border-line bg-surface p-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-600 text-sm font-semibold text-white">{n}</span>
            <h3 className="mt-5 text-lg font-semibold">{t}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">{d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Features() {
  const f = [
    ["Money in vs. out", "See every day, week or month at a glance — and spot the months that got away."],
    ["Per person & merchant", "Who you send to most, who pays you, and the full history with each of them."],
    ["Balance check & gaps", "We replay your balance through every message and flag anything unexplained."],
    ["When you spend", "A weekday-by-hour map of your habits, plus morning/evening and weekend filters."],
    ["Fees, loans & remittances", "Service fees and VAT, telebirr credit and repayments, remittances and their bonuses."],
    ["Official receipts", "Every transaction links to its official receipt, straight from your SMS."],
  ];
  return (
    <section id="features" className="scroll-mt-20 bg-surface py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionTitle eyebrow="Features" title="A report you’ll actually use" sub="Rich filters by period, person, direction, type, time of day and weekday — across telebirr and CBE." />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {f.map(([t, d]) => (
            <div key={t} className="rounded-3xl border border-line bg-page p-6 transition hover:border-brand-300">
              <h3 className="font-semibold">{t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Privacy() {
  const rows = [
    ["Your PDF or messages database", "Stays on your device", "Read in your browser, never uploaded."],
    ["Your telebirr & CBE messages", "Only if you save", "Sign in to keep reports across devices. Delete any time."],
    ["Everything else in your messages", "Never touched", "We only read messages from telebirr (127) and CBE."],
  ];
  return (
    <section id="privacy" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">Privacy first</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Your messages never leave your device</h2>
          <p className="mt-4 text-ink-2">
            Bamanbirr does the analysis right in your browser. There’s no AI service and no upload needed to see your
            report. If you create an account, only your telebirr and CBE messages are stored — so you can reopen and
            re-run your reports — and you can delete them whenever you like.
          </p>
        </div>
        <div className="overflow-hidden rounded-3xl border border-line bg-surface">
          {rows.map(([a, b, c], i) => (
            <div key={a} className={`grid grid-cols-[1fr_auto] gap-4 p-5 ${i ? "border-t border-line" : ""}`}>
              <div>
                <p className="font-medium">{a}</p>
                <p className="mt-1 text-sm text-ink-2">{c}</p>
              </div>
              <span className="self-start rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 dark:bg-brand-950 dark:text-brand-200">{b}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Formats() {
  const f = [
    ["PDF export", "From the Messages app (Print → Save as PDF). Scroll to the very first message before exporting."],
    ["Mac / iPhone database", "chat.db (+ chat.db-wal) from your Mac’s Messages folder — the most complete history."],
    ["Android SMS backup", "An XML file from “SMS Backup & Restore”. Our Android app will read your SMS directly."],
  ];
  return (
    <section className="bg-surface py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionTitle eyebrow="Supported" title="Bring your messages the way that suits you" />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {f.map(([t, d]) => (
            <div key={t} className="rounded-3xl border border-line bg-page p-6">
              <h3 className="font-semibold">{t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Faq() {
  const q = [
    ["Is it really free?", "Yes. Analysing your messages is free and needs no account. An account lets you save reports and see them across devices."],
    ["Do you use AI or send my data anywhere?", "No. The analysis is plain, predictable code that runs in your browser. Nothing is sent to an AI service."],
    ["Which messages does it read?", "Only messages from telebirr (127) and CBE. Everything else in your messages is ignored."],
    ["What if a message is missing?", "Every telebirr and CBE SMS states your balance, so Bamanbirr detects gaps and shows exactly where they are."],
    ["Is Bamanbirr made by telebirr or CBE?", "No — Bamanbirr is an independent product by Baman Technologies."],
  ];
  return (
    <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-20 sm:px-6">
      <SectionTitle eyebrow="FAQ" title="Questions, answered" />
      <div className="mt-10 divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
        {q.map(([a, b]) => (
          <details key={a} className="group p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
              {a}
              <span className="text-muted transition group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-ink-2">{b}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="px-4 pb-20 sm:px-6">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand-400 via-brand-500 to-brand-700 px-6 py-14 text-center text-white sm:px-12">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">See where your money really goes</h2>
        <p className="mx-auto mt-3 max-w-xl text-white/85">It takes about a minute, and your messages stay on your device.</p>
        <Link href="/analyze" className="mt-8 inline-block rounded-full bg-white px-7 py-3 font-medium text-brand-700 shadow-lg transition hover:bg-brand-50">
          Analyze my messages
        </Link>
      </div>
    </section>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <path d="M4.5 10.5l3.5 3.5 7.5-8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
