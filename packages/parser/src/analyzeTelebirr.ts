import { chain, signedTotal, stripRefs } from "./chain";
import { applyLabels } from "./labels";
import { splitMessages } from "./split";
import { parseTelebirr, telebirrMessageText, telebirrReceipt } from "./telebirr";
import { PARSER_VERSION, cmpTuple, ts } from "./util";
import type { LabelRule, ProgressFn, SmsRecord, SourceReport, Transaction } from "./types";

export interface AnalyzeOptions {
  labels?: LabelRule[];
  onProgress?: ProgressFn;
}

export function analyzeTelebirr(records: SmsRecord[], opts: AnalyzeOptions = {}): SourceReport {
  const sms: { smsTime: string | null; text: string }[] = [];
  for (const r of records) for (const chunk of splitMessages(r.text)) sms.push({ smsTime: r.smsTime, text: chunk });

  const counts: Record<string, number> = {};
  const txs: Transaction[] = [];
  const unknown: SourceReport["unknown"] = [];
  const bonuses: SourceReport["bonuses"] = [];
  const loans: SourceReport["loans"] = [];
  const cancelled: SourceReport["cancelled"] = [];

  sms.forEach(({ smsTime, text: m }, i) => {
    const res = parseTelebirr(m);
    counts[res.cat] = (counts[res.cat] ?? 0) + 1;
    if (res.cat === "bonus") bonuses.push({ amount: res.amount, smsTime });
    else if (res.cat === "loan_approved") loans.push({ ...res.loan, smsTime });
    else if (res.cat === "cancelled") cancelled.push({ txn: res.txn, amount: res.amount, balance: res.balance, smsTime });
    else if (res.cat === "tx") {
      const t = res.tx;
      const timeFromSms = !t.datetime;
      txs.push({
        source: "telebirr", ...t, account: t.account ?? null,
        datetime: t.datetime ?? smsTime ?? "", timeFromSms, smsTime,
        total: 0, balanceEst: null, balanceOk: null,
        receipt: telebirrReceipt(m), message: telebirrMessageText(m),
      });
    } else if (res.cat === "unknown_money" || res.cat === "other") unknown.push({ smsTime, text: m.slice(0, 240) });
    if (i % 200 === 0) opts.onProgress?.("parsing", i, sms.length);
  });
  opts.onProgress?.("parsing", sms.length, sms.length);

  // Dedupe: by transaction number, else by (time, amount, kind, counterparty)
  const seen = new Set<string>();
  const uniq: Transaction[] = [];
  let duplicates = 0;
  for (const t of txs) {
    const key = t.txn ?? JSON.stringify([t.datetime, t.amount, t.kind, t.counterparty]);
    if (seen.has(key)) { duplicates++; continue; }
    seen.add(key); uniq.push(t);
  }

  // Each remittance comes with a bonus SMS a few seconds apart; the remittance's
  // stated balance already includes the bonus. Pair them 1:1 by arrival time.
  const remits = uniq.filter((t) => t.kind === "Remittance received" && t.smsTime);
  const used = new Set<number>();
  for (const b of uniq.filter((t) => t.kind === "Remittance bonus" && t.smsTime)) {
    const cands = remits
      .map((r, i) => [Math.abs(ts(r.smsTime!) - ts(b.smsTime!)), i] as const)
      .filter(([, i]) => !used.has(i))
      .sort((a, c) => a[0] - c[0] || a[1] - c[1]);
    if (cands.length && cands[0][0] < 600) {
      const r = remits[cands[0][1]];
      used.add(cands[0][1]);
      b.datetime = r.datetime; b.timeFromSms = false; b.pairedTxn = r.txn; b.rank = 0;
    }
  }
  // A loan arrives as "credited with" (no date) seconds around its 1% fund fee;
  // the credit SMS's balance already has the fee taken off.
  const credits = uniq.filter((t) => t.kind === "Credited (loan / other)" && t.smsTime);
  for (const f of uniq.filter((t) => t.kind === "Loan fees" && t.smsTime)) {
    const near = credits
      .map((c, i) => [Math.abs(ts(c.smsTime!) - ts(f.smsTime!)), i] as const)
      .filter(([d]) => d < 900)
      .sort((a, c) => a[0] - c[0] || a[1] - c[1]);
    if (near.length) {
      const c = credits[near[0][1]];
      f.datetime = c.datetime; c.rank = 0; f.rank = 2; c.balanceAfterFee = true;
    }
  }
  uniq.sort((a, b) => cmpTuple([a.datetime ?? "", a.rank ?? 1, a.smsTime ?? ""], [b.datetime ?? "", b.rank ?? 1, b.smsTime ?? ""]));

  applyLabels(uniq, "telebirr", opts.labels);

  opts.onProgress?.("checking", 0, uniq.length);
  for (const t of uniq) t.total = signedTotal(t);
  const breaks = chain(uniq);
  opts.onProgress?.("checking", uniq.length, uniq.length);

  return {
    source: "telebirr", title: "telebirr transactions", balanceLabel: "telebirr balance",
    counts, duplicates, unknown, balanceBreaks: stripRefs(breaks), bonuses, loans, cancelled,
    transactions: uniq, parserVersion: PARSER_VERSION,
  };
}
