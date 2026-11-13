"use client";
import { useMemo, useState, type ReactNode } from "react";
import type { AnalysisResult, Source, SourceReport } from "@bamanbirr/parser";
import { BalanceChart, FlowChart, HBars, Heatmap } from "./charts";
import { FilterBar } from "./filters";
import { LoansAndGaps, PeopleTable, TxTable } from "./tables";
import { TooltipProvider } from "./tooltip";
import {
  applyFilters, daysBetween, enrich, fmt, groupBy, initialFilters, niceDay, sgn, sum, type Filters,
} from "@/lib/report/model";

const NAMES: Record<Source, string> = { telebirr: "telebirr", cbe: "CBE" };

export function Report({ result }: { result: AnalysisResult }) {
  const sources = (["telebirr", "cbe"] as Source[]).filter((s) => result[s]);
  const [tab, setTab] = useState<Source>(sources[0]);
  if (!sources.length) return null;
  return (
    <TooltipProvider>
      {sources.length > 1 && (
        <div role="tablist" className="mb-6 inline-flex rounded-2xl border border-line bg-surface p-1">
          {sources.map((s) => (
            <button key={s} role="tab" aria-selected={tab === s} onClick={() => setTab(s)}
              className={`rounded-xl px-5 py-2 text-sm transition ${tab === s ? "bg-brand-600 font-semibold text-white shadow-sm" : "text-ink-2 hover:text-ink"}`}>
              {NAMES[s]} <span className={`tabular ml-1 text-xs ${tab === s ? "text-white/80" : "text-muted"}`}>{result[s]!.transactions.length.toLocaleString("en-US")}</span>
            </button>
          ))}
        </div>
      )}
      {sources.map((s) => (
        <div key={s} hidden={tab !== s}><SourceView report={result[s]!} /></div>
      ))}
    </TooltipProvider>
  );
}

const Card = ({ title, sub, children, className = "" }: { title: string; sub?: string; children: ReactNode; className?: string }) => (
  <section className={`min-w-0 rounded-3xl border border-line bg-surface p-5 ${className}`}>
    <h3 className="font-semibold">{title}</h3>
    {sub && <p className="mt-0.5 text-[13px] text-ink-2">{sub}</p>}
    <div className="mt-4">{children}</div>
  </section>
);

function SourceView({ report }: { report: SourceReport }) {
  const all = useMemo(() => enrich(report), [report]);
  const minDay = all[0]?.day ?? "", maxDay = all[all.length - 1]?.day ?? "";
  const [f, setF] = useState<Filters>(() => initialFilters(all));
  const set = (p: Partial<Filters>) => setF((cur) => ({ ...cur, ...p }));
  const pick = (person: string) => { set({ person }); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const rows = useMemo(() => applyFilters(all, f), [all, f]);
  const base = useMemo(() => applyFilters(all, f, true), [all, f]);
  const inn = rows.filter((t) => t.total > 0), out = rows.filter((t) => t.total < 0);
  const tIn = sum(inn, (t) => t.total), tOut = -sum(out, (t) => t.total), fees = sum(rows, (t) => t.fee + t.vat);
  const days = daysBetween(f.from, f.to) + 1;
  const inRange = all.filter((t) => t.day >= f.from && t.day <= f.to && t.bal != null);
  const open = inRange.length ? inRange[0].bal! - inRange[0].total : null, close = inRange.length ? inRange[inRange.length - 1].bal : null;
  const gaps = sum(report.balanceBreaks.filter((b) => b.datetime.slice(0, 10) >= f.from && b.datetime.slice(0, 10) <= f.to), (b) => b.diff);
  const c = report.counts;
  const notMoney = Object.entries(c).filter(([k]) => k !== "tx").map(([k, v]) => `${v} ${k.replace(/_/g, " ")}`).join(", ");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{report.title}</h2>
          <p className="mt-1 text-sm text-ink-2">
            {all.length.toLocaleString("en-US")} transactions · {niceDay(minDay)} {minDay.slice(0, 4)} – {niceDay(maxDay)} {maxDay.slice(0, 4)} · amounts in ETB
          </p>
        </div>
      </div>

      <FilterBar all={all} f={f} set={set} minDay={minDay} maxDay={maxDay} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Tile label="Money in" value={fmt(tIn)} note={`${inn.length} credits`} tone="in" />
        <Tile label="Money out" value={fmt(tOut)} note={`${out.length} debits, incl. fees`} tone="out" />
        <Tile label="Net" value={sgn(tIn - tOut)} note={gaps ? `balance gaps ${sgn(gaps)} more` : "in minus out"} />
        <Tile label="Fees + VAT" value={fmt(fees)} note={`${rows.filter((t) => t.fee + t.vat > 0).length} charged`} />
        <Tile label="Avg out / day" value={fmt(tOut / days)} note={`over ${days} day${days === 1 ? "" : "s"}`} />
        <Tile label="Balance" value={close != null ? fmt(close) : "–"} note={open != null ? `from ${fmt(open)}` : ""} />
      </div>

      {f.person && <PersonCard rows={rows} person={f.person} onClear={() => set({ person: "" })} />}

      <Card title="Money in vs. money out" sub={`Per ${f.group}. In above the line, out (incl. fees) below. Hover or tap for details.`}>
        <div className="mb-2 flex gap-4 text-[12px] text-ink-2">
          <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-in" />In</span>
          <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-out" />Out</span>
        </div>
        <FlowChart rows={rows} f={f} />
      </Card>

      <Card title={report.balanceLabel} sub="Your balance after each transaction, from the SMS. Follows the date range only.">
        <BalanceChart all={all} f={f} />
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Out by category" sub="ETB, including fees">
          <HBars items={groupBy(rows.filter((t) => t.direction === "out"), (t) => t.kind, (t) => -t.total)} color="var(--out)" extra={(g) => `${g.n} transactions`} />
        </Card>
        <Card title="In by source" sub="ETB">
          <HBars items={groupBy(rows.filter((t) => t.direction === "in"), (t) => t.kind, (t) => t.total)} color="var(--in)" extra={(g) => `${g.n} transactions`} />
        </Card>
        <Card title="Top people & merchants — sent" sub="Click a name to focus on them">
          <HBars items={groupBy(base.filter((t) => t.direction === "out"), (t) => t.counterparty, (t) => -t.total).slice(0, 10)} color="var(--out)" onPick={pick} extra={(g) => `${g.n} transaction${g.n > 1 ? "s" : ""}`} />
        </Card>
        <Card title="Top people & sources — received" sub="Click a name to focus on them">
          <HBars items={groupBy(base.filter((t) => t.direction === "in"), (t) => t.counterparty, (t) => t.total).slice(0, 10)} color="var(--in)" onPick={pick} extra={(g) => `${g.n} transaction${g.n > 1 ? "s" : ""}`} />
        </Card>
      </div>

      <Card title="When you transact" sub="Number of transactions by weekday and hour"><Heatmap rows={rows} /></Card>
      <Card title="Per person" sub="Everyone in the current filters. Click a row to focus; click a column to sort."><PeopleTable rows={base} onPick={pick} /></Card>
      <Card title="Transactions" sub={`${rows.length.toLocaleString("en-US")} transactions, newest first. Click a receipt number to open the official receipt.`}><TxTable rows={rows} onPick={pick} /></Card>
      <LoansAndGaps report={report} tx={all} />
      <p className="text-xs text-muted">
        Read {Object.values(c).reduce((a, b) => a + b, 0).toLocaleString("en-US")} messages: {c.tx ?? 0} transactions ({report.duplicates} duplicates dropped); not money moves: {notMoney || "none"}.
        {report.unknown.length > 0 && ` ${report.unknown.length} messages mention money in a wording we don’t recognise yet.`}
      </p>
    </div>
  );
}

function Tile({ label, value, note, tone }: { label: string; value: string; note: string; tone?: "in" | "out" }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-[12px] text-ink-2">{label}</p>
      <p className={`tabular mt-1 truncate text-xl font-semibold ${tone === "in" ? "text-in" : tone === "out" ? "text-out" : ""}`}>{value}</p>
      <p className="mt-0.5 truncate text-[12px] text-muted">{note}</p>
    </div>
  );
}

function PersonCard({ rows, person, onClear }: { rows: ReturnType<typeof applyFilters>; person: string; onClear: () => void }) {
  const sent = sum(rows.filter((t) => t.direction === "out"), (t) => t.amount);
  const recv = sum(rows.filter((t) => t.direction === "in"), (t) => t.amount);
  const fees = sum(rows, (t) => t.fee + t.vat);
  const accts = [...new Set(rows.map((t) => t.account).filter(Boolean))];
  const acct = accts.slice(0, 3).join(", ") + (accts.length > 3 ? ` +${accts.length - 3} more` : "");
  return (
    <section className="rounded-3xl border border-brand-300 bg-brand-50/60 p-5 dark:border-brand-800 dark:bg-brand-950/40">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{person}</h3>
          <p className="mt-0.5 text-[13px] text-ink-2">
            {acct ? `${acct} · ` : ""}{rows.length} transaction{rows.length === 1 ? "" : "s"} in the current filters
            {rows.length ? ` · ${rows[0].day} → ${rows[rows.length - 1].day}` : ""}
          </p>
        </div>
        <button onClick={onClear} className="rounded-full border border-line bg-surface px-3 py-1 text-[13px] text-ink-2 hover:text-ink">✕ Show everyone</button>
      </div>
      <div className="mt-4 flex flex-wrap gap-8 tabular">
        {[["Sent", fmt(sent)], ["Received", fmt(recv)], ["Fees paid", fmt(fees)], ["Net", sgn(recv - sent - fees)], ["Avg per transaction", rows.length ? fmt((sent + recv) / rows.length) : "–"]].map(([l, v]) => (
          <div key={l}><p className="text-[12px] text-ink-2">{l}</p><p className="mt-0.5 text-lg font-semibold">{v}</p></div>
        ))}
      </div>
    </section>
  );
}
