"use client";
import { useMemo, useState } from "react";
import type { SourceReport } from "@bamanbirr/parser";
import { fmt, people, sgn, sum, type PersonRow, type Tx } from "@/lib/report/model";

const th = "px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted";
const td = "px-3 py-2 whitespace-nowrap";

export function PeopleTable({ rows, onPick }: { rows: Tx[]; onPick: (p: string) => void }) {
  const [sort, setSort] = useState<{ key: keyof PersonRow; desc: boolean }>({ key: "total", desc: true });
  const list = useMemo(() => {
    const l = people(rows);
    l.sort((a, b) => { const x = a[sort.key], y = b[sort.key]; const c = typeof x === "string" ? x.localeCompare(String(y)) : (x as number) - (y as number); return sort.desc ? -c : c; });
    return l;
  }, [rows, sort]);
  const [limit, setLimit] = useState(25);
  if (!list.length) return <p className="py-8 text-center text-sm text-muted">No people for these filters.</p>;
  const cols: [keyof PersonRow, string, boolean][] = [["name", "Name", false], ["n", "Txns", true], ["sent", "Sent", true], ["recv", "Received", true], ["fees", "Fees", true], ["net", "Net", true], ["last", "Last", false]];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px] tabular">
        <thead className="border-b border-line">
          <tr>{cols.map(([k, l, n]) => (
            <th key={k} className={`${th} select-none ${n ? "text-right" : ""}`} aria-sort={sort.key === k ? (sort.desc ? "descending" : "ascending") : undefined}>
              <button onClick={() => setSort({ key: k, desc: sort.key === k ? !sort.desc : k !== "name" })}
                className={`block w-full uppercase tracking-wide hover:text-ink focus-visible:text-ink ${n ? "text-right" : "text-left"}`}>
                {l}{sort.key === k ? (sort.desc ? " ↓" : " ↑") : ""}
              </button>
            </th>
          ))}</tr>
        </thead>
        <tbody>
          {list.slice(0, limit).map((o) => (
            <tr key={o.name} onClick={() => onPick(o.name)} className="cursor-pointer border-b border-line/70 hover:bg-wash">
              <td className={`${td} font-medium`}>
                <button onClick={(e) => { e.stopPropagation(); onPick(o.name); }} className="text-left hover:text-brand-600 hover:underline">{o.name}</button>
              </td>
              <td className={`${td} text-right`}>{o.n}</td>
              <td className={`${td} text-right`}>{o.sent ? fmt(o.sent) : "–"}</td>
              <td className={`${td} text-right`}>{o.recv ? fmt(o.recv) : "–"}</td>
              <td className={`${td} text-right`}>{o.fees ? fmt(o.fees) : "–"}</td>
              <td className={`${td} text-right ${o.net > 0 ? "text-good" : ""}`}>{sgn(o.net)}</td>
              <td className={`${td} text-muted`}>{o.last.slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.length > limit && <ShowMore onClick={() => setLimit(limit + 50)} left={list.length - limit} />}
    </div>
  );
}

const ShowMore = ({ onClick, left }: { onClick: () => void; left: number }) => (
  <div className="pt-3 text-center">
    <button onClick={onClick} className="rounded-full border border-line px-4 py-1.5 text-[13px] text-ink-2 hover:border-brand-300 hover:text-ink">Show more ({left.toLocaleString("en-US")} left)</button>
  </div>
);

export function TxTable({ rows, onPick }: { rows: Tx[]; onPick: (p: string) => void }) {
  const [limit, setLimit] = useState(50);
  const [open, setOpen] = useState<string | null>(null);
  const list = useMemo(() => [...rows].reverse(), [rows]);
  if (!list.length) return <p className="py-8 text-center text-sm text-muted">No transactions match these filters.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px] tabular">
        <thead className="border-b border-line">
          <tr>
            <th className={th}>Date & time</th><th className={th}>Receipt</th><th className={th}>Type</th><th className={th}>Person / merchant</th>
            <th className={`${th} text-right`}>Amount</th><th className={`${th} text-right`}>Fee + VAT</th><th className={`${th} text-right`}>Total</th><th className={`${th} text-right`}>Balance</th><th className={th} />
          </tr>
        </thead>
        <tbody>
          {list.slice(0, limit).map((t, i) => {
            const key = (t.txn ?? "") + t.datetime + i;
            return (
              <FragmentRow key={key} t={t} open={open === key} toggle={() => setOpen(open === key ? null : key)} onPick={onPick} />
            );
          })}
        </tbody>
      </table>
      {list.length > limit && <ShowMore onClick={() => setLimit(limit + 100)} left={list.length - limit} />}
    </div>
  );
}

function FragmentRow({ t, open, toggle, onPick }: { t: Tx; open: boolean; toggle: () => void; onPick: (p: string) => void }) {
  return (
    <>
      <tr className="border-b border-line/70 hover:bg-wash">
        <td className={`${td} text-ink-2`}>{t.datetime.slice(0, 16)}</td>
        <td className={td}>
          {t.receipt
            ? <a href={t.receipt} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-600 hover:underline" title="Open the official receipt">{t.txn ?? "Receipt"} ↗</a>
            : <span className="text-muted" title="This SMS had no receipt link">{t.txn ?? "–"}</span>}
        </td>
        <td className={td}>{t.kind}</td>
        <td className={td}>
          <button onClick={() => onPick(t.counterparty)} className="hover:text-brand-600 hover:underline" title={t.labelNote}>{t.counterparty}</button>
          {t.labelNote && <span className="ml-1.5 rounded-full border border-line px-1.5 text-[10px] text-muted">label</span>}
        </td>
        <td className={`${td} text-right`}>{fmt(t.amount)}</td>
        <td className={`${td} text-right text-muted`}>{t.fee + t.vat ? fmt(t.fee + t.vat) : "–"}</td>
        <td className={`${td} text-right font-medium ${t.total > 0 ? "text-good" : ""}`}>{sgn(t.total)}</td>
        <td className={`${td} text-right`}>{t.bal != null ? fmt(t.bal) : "–"}</td>
        <td className={td}><button onClick={toggle} className="text-[12px] text-brand-600 hover:underline">{open ? "Hide SMS" : "SMS"}</button></td>
      </tr>
      {open && (
        <tr className="border-b border-line/70 bg-surface-2/60">
          <td colSpan={9} className="px-3 py-3 text-[13px] leading-relaxed whitespace-normal text-ink-2">{t.message}</td>
        </tr>
      )}
    </>
  );
}

export function LoansAndGaps({ report, tx }: { report: SourceReport; tx: Tx[] }) {
  const L = report.loans;
  const rep = sum(tx.filter((t) => t.kind === "Loan repayment"), (t) => t.amount);
  const fund = sum(tx.filter((t) => t.kind === "Loan fees"), (t) => t.amount);
  const G = report.balanceBreaks;
  return (
    <div className={`grid gap-4 ${L.length ? "lg:grid-cols-2" : ""}`}>
      {L.length > 0 && (
        <div className="min-w-0 rounded-3xl border border-line bg-surface p-5">
          <h3 className="font-semibold">Loans</h3>
          <p className="mt-1 text-[13px] text-ink-2">
            {L.length} loans · {fmt(sum(L, (l) => l.amount))} borrowed · facilitation fees {fmt(sum(L, (l) => l.facilitationFee))} · repaid (with SMS) {fmt(rep)} · fund charges {fmt(fund)}
          </p>
          <table className="mt-3 w-full text-[13px] tabular">
            <thead className="border-b border-line"><tr><th className={th}>Approved</th><th className={`${th} text-right`}>Amount</th><th className={`${th} text-right`}>Fee</th><th className={th}>Due</th></tr></thead>
            <tbody>{L.map((l, i) => (
              <tr key={i} className="border-b border-line/70"><td className={td}>{(l.smsTime ?? "").slice(0, 10)}</td><td className={`${td} text-right`}>{fmt(l.amount)}</td><td className={`${td} text-right`}>{fmt(l.facilitationFee)}</td><td className={td}>{l.due}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <div className="min-w-0 rounded-3xl border border-line bg-surface p-5">
        <h3 className="font-semibold">Balance check</h3>
        <p className="mt-1 text-[13px] text-ink-2">
          {G.length
            ? `${(tx.length - G.length).toLocaleString("en-US")} of ${tx.length.toLocaleString("en-US")} balances follow exactly from the previous one. These ${G.length} changes aren’t explained by any SMS — usually automatic deductions or fees sent without a message.`
            : "Every balance follows exactly from the previous one — no messages are missing."}
        </p>
        {G.length > 0 && (
          <div className="mt-3 max-h-80 overflow-auto">
            <table className="w-full text-[13px] tabular">
              <thead className="sticky top-0 border-b border-line bg-surface"><tr><th className={th}>When</th><th className={th}>Next SMS</th><th className={`${th} text-right`}>Unexplained</th></tr></thead>
              <tbody>{G.map((g, i) => (
                <tr key={i} className="border-b border-line/70"><td className={td}>{g.datetime.slice(0, 16)}</td><td className={td}>{g.kind}</td><td className={`${td} text-right ${g.diff > 0 ? "text-good" : "text-out"}`}>{sgn(g.diff)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
