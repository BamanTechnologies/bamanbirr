// Commercial Bank of Ethiopia SMS. Ported 1:1 from parse_cbe.py.
import { chain, signedTotal, stripRefs, type RefBreak } from "./chain";
import { applyLabels } from "./labels";
import { splitMessages } from "./split";
import { PARSER_VERSION, cleanName, cmpTuple, dt, num, round2, ts } from "./util";
import type { Direction, LabelRule, ProgressFn, SmsRecord, SourceReport, Transaction } from "./types";

const R = (s: string) => new RegExp(s);
const A = String.raw`ETB\s*([\d,]+(?:\.\d+)?)`;
const BAL = R(String.raw`[Cc]urrent [Bb]alance is\s*ETB\s*([\d,]+(?:\.\d+)?)`);
const ACC = String.raw`(1\*+\d{4})`;
const CBE_STRIP = " -;.,()";

const refOf = (m: string) => (m.match(/\b(FT[0-9A-Z]{10})/) ?? [])[1] ?? null;

/** (service charge, VAT + levies, total). Uses itemised charges: older messages print a rounded total. */
export function cbeFees(m: string, amount: number): [number, number, number] {
  const g = (p: string) => { const r = m.match(R(p)); return r ? num(r[1]) : null; };
  let sc = g(String.raw`(?:Service charge of|S\.charge of)\s*ETB\s*([\d,]+(?:\.\d+)?)`);
  const vat = g(String.raw`VAT(?:\(15%\))? of\s*ETB\s*([\d,]+(?:\.\d+)?)`);
  const dr = g(String.raw`Disaster Recovery\(5%\) of\s*(?:ETB\s*)?([\d,]+(?:\.\d+)?)`);
  const tot = g(String.raw`total of\s*ETB\s*([\d,]+(?:\.\d+)?)`);
  if (sc === null && vat === null) {
    const extra = tot !== null ? round2(tot - amount) : 0;
    return [extra, 0, amount + extra];
  }
  sc = sc ?? 0;
  const levies = round2((vat ?? 0) + (dr ?? 0));
  if (tot !== null && Math.abs(tot - amount) < 0.005 && sc + levies > 0) return [sc, levies, amount]; // fees inside the amount
  return [sc, levies, round2(amount + sc + levies)];
}

const dmyAt = (d: string, t: string) => dt(`${d} ${t}`);

interface CbeRaw { kind: string; direction: Direction; amount: number; counterparty: string; fee?: number; vat?: number;
  account?: string | null; datetime?: string | null; timeFromSms?: boolean }

export function parseCbe(m: string): { cat: "tx"; tx: CbeRaw } | { cat: "notice" | "unknown_money" } {
  if (!/ETB/.test(m)) return { cat: "notice" };
  const T = (x: CbeRaw) => ({ cat: "tx" as const, tx: x });
  let r: RegExpMatchArray | null;

  // Monthly mobile banking fee: "debited with ETB 5.75 including Service charge ... Info: X including"
  if ((r = m.match(R(String.raw`debited with\s*${A} including Service charge.*?Info:\s*(.+?) including`))))
    return T({ kind: "Bank fee", direction: "out", amount: 0, counterparty: cleanName(r[2], CBE_STRIP), fee: num(r[1]), vat: 0 });
  // "You have transfered ETB X to NAME on DD/MM/YYYY at HH:MM:SS from your account ..."
  if ((r = m.match(R(String.raw`transfer+ed\s*${A} to (.+?) on (\d{2}/\d{2}/\d{4}) at (\d{2}:\d{2}:\d{2})`)))) {
    const amt = num(r[1]); const [fee, vat] = cbeFees(m, amt);
    return T({ kind: "Transfer out", direction: "out", amount: amt, counterparty: cleanName(r[2], CBE_STRIP), fee, vat,
      datetime: dmyAt(r[3], r[4]), timeFromSms: false });
  }
  // "You have successfully transferred ETB X from account A to account B (NAME)."
  if ((r = m.match(R(String.raw`successfully transferred\s*${A} from account \S+ to account ${ACC}\s*\((.+?)\)`)))) {
    let amt = num(r[1]); const [fee, vat, total] = cbeFees(m, amt);
    if (Math.abs(total - amt) < 0.005 && fee + vat > 0) amt = round2(amt - fee - vat); // printed amount includes fees
    return T({ kind: "Transfer out", direction: "out", amount: amt, counterparty: cleanName(r[3], CBE_STRIP), account: r[2], fee, vat });
  }
  // "A debit transaction of ETB X. has occurred ..." / "has been debited with ETBX ."
  if ((r = m.match(R(String.raw`debit transaction of\s*${A}`)) ?? m.match(R(String.raw`has been debited with\s*${A}`)))) {
    const amt = num(r[1]); const [fee, vat] = cbeFees(m, amt);
    return T({ kind: "Debit (no details)", direction: "out", amount: amt, counterparty: "Unspecified debit", fee, vat });
  }
  // "You have received ETB X from account A (NAME) to your account"
  if ((r = m.match(R(String.raw`received\s*${A} from account ${ACC}\s*\((.+?)\)`))))
    return T({ kind: "Received", direction: "in", amount: num(r[1]), counterparty: cleanName(r[3], CBE_STRIP), account: r[2] });
  // "has been Credited with ETB X from NAME, on DD/MM/YYYY at HH:MM:SS with Ref No ..."
  if ((r = m.match(R(String.raw`[Cc]redited with\s*${A} from (.+?), on (\d{2}/\d{2}/\d{4}) at (\d{2}:\d{2}:\d{2})`))))
    return T({ kind: "Received", direction: "in", amount: num(r[1]), counterparty: cleanName(r[2], CBE_STRIP),
      datetime: dmyAt(r[3], r[4]), timeFromSms: false });
  // "has been credited with ETB X to 912051241 with reference FT..."  (from telebirr)
  if ((r = m.match(R(String.raw`[Cc]redited with\s*${A} to (\d+)`))))
    return T({ kind: "Received", direction: "in", amount: num(r[1]), counterparty: "telebirr wallet", account: r[2] });
  // "has been credited by DAHABSHIIL MTO with ETB 8000.00."
  if ((r = m.match(R(String.raw`[Cc]redited by (.+?) with\s*${A}`))))
    return T({ kind: "Received", direction: "in", amount: num(r[2]), counterparty: cleanName(r[1].replace(/\s*ETB$/, ""), CBE_STRIP) });
  // "has been credited with ETB X. Your Current Balance ..."
  if ((r = m.match(R(String.raw`[Cc]redited with\s*${A}`))))
    return T({ kind: "Deposit (no details)", direction: "in", amount: num(r[1]), counterparty: "Unspecified credit" });
  return { cat: "unknown_money" };
}

const cbeReceipt = (m: string) => {
  const l = m.match(/https?:\/\/(?:apps\.cbe\.com\.et:100|[Mm]breciept\.cbe\.com\.et)\S+/);
  return l ? l[0].replace(/[.,]+$/, "") : null;
};
const cbeMessageText = (m: string) => m.replace(/\s*(https?:\/\/\S+|For feedback.*|for Reciept.*)$/, "").trim();

/** Name CBE entries that are one side of a CBE <-> telebirr transfer (same amount, within 15 min). */
export function linkTelebirr(txs: Transaction[], tele: Transaction[]): number {
  const cands: Record<Direction, Transaction[]> = {
    out: tele.filter((t) => t.kind === "Received from bank" && t.counterparty.includes("Commercial")),
    in: tele.filter((t) => t.kind === "Transfer to bank" && t.counterparty.includes("Commercial")),
  };
  const used = new Set<string>();
  let n = 0;
  for (const t of txs) {
    if (!["Unspecified debit", "Unspecified credit", "telebirr wallet"].includes(t.counterparty)) continue;
    let best: [number, number, Transaction] | null = null;
    cands[t.direction].forEach((c, i) => {
      if (used.has(`${t.direction}:${i}`) || Math.abs(c.amount - t.amount) > 0.005) return;
      const d = Math.abs(ts(c.datetime) - ts(t.datetime));
      if (d < 900 && (best === null || d < best[0])) best = [d, i, c];
    });
    if (best) {
      const [, i, c] = best as [number, number, Transaction];
      used.add(`${t.direction}:${i}`);
      t.counterparty = "telebirr wallet";
      t.kind = t.direction === "out" ? "To telebirr" : "From telebirr";
      t.linkedTxn = c.txn;
      n++;
    }
  }
  return n;
}

const cost = (b: RefBreak[]) => b.reduce((s, x) => s + Math.abs(x.diff), 0);

export interface CbeOptions { labels?: LabelRule[]; telebirr?: Transaction[]; onProgress?: ProgressFn }

export function analyzeCbe(records: SmsRecord[], opts: CbeOptions = {}): SourceReport {
  const counts: Record<string, number> = {};
  const txs: Transaction[] = [];
  const unknown: SourceReport["unknown"] = [];
  // A PDF export groups every message under one date header into one record;
  // split those (single SMS from chat.db / XML are kept exactly as they are).
  records = records.flatMap((rec) => {
    const parts = splitMessages(rec.text);
    return parts.length > 1 ? parts.map((text) => ({ ...rec, text })) : [rec];
  });
  records.forEach((rec, i) => {
    const m = rec.text.replace(/\s+/g, " ").trim();
    const res = parseCbe(m);
    counts[res.cat] = (counts[res.cat] ?? 0) + 1;
    if (res.cat === "tx") {
      const x = res.tx;
      const bal = m.match(BAL);
      txs.push({
        source: "cbe", kind: x.kind, direction: x.direction, amount: x.amount, fee: x.fee ?? 0, vat: x.vat ?? 0, total: 0,
        counterparty: x.counterparty, account: x.account ?? null,
        datetime: x.datetime ?? rec.smsTime ?? "", timeFromSms: x.timeFromSms ?? true, smsTime: rec.smsTime,
        txn: refOf(m), balance: bal ? num(bal[1]) : null, balanceEst: null, balanceOk: null,
        receipt: cbeReceipt(m), message: cbeMessageText(m),
      });
    } else if (res.cat === "unknown_money") unknown.push({ smsTime: rec.smsTime, text: m.slice(0, 240) });
    if (i % 100 === 0) opts.onProgress?.("parsing", i, records.length);
  });
  opts.onProgress?.("parsing", records.length, records.length);

  const seen = new Set<string>();
  let uniq: Transaction[] = [];
  let duplicates = 0;
  for (const t of txs) {
    const key = t.txn ?? JSON.stringify([t.smsTime, t.amount, t.kind]);
    if (seen.has(key)) { duplicates++; continue; }
    seen.add(key); uniq.push(t);
  }
  uniq.sort((a, b) => cmpTuple([a.datetime, a.smsTime ?? ""], [b.datetime, b.smsTime ?? ""]));

  opts.onProgress?.("linking", 0, 1);
  const linked = opts.telebirr ? linkTelebirr(uniq, opts.telebirr) : 0;
  applyLabels(uniq, "cbe", opts.labels);
  opts.onProgress?.("linking", 1, 1);

  for (const t of uniq) t.total = signedTotal(t);
  let breaks = chain(uniq);
  // SMS without a time in the text are dated by arrival, and banks sometimes send
  // them late. Try moving each such entry a few places earlier; keep the move only
  // when it reduces the total unexplained amount.
  for (let iter = 0; iter < 100; iter++) {
    opts.onProgress?.("checking", iter, 100);
    let improved = false;
    const idx = new Map(uniq.map((t, i) => [t, i]));
    outer: for (const b of breaks) {
      const i = idx.get(b.ref)!;
      for (let j = i + 1; j < Math.min(uniq.length, i + 6); j++) {
        if (!uniq[j].timeFromSms) continue;
        for (let k = Math.max(0, i - 4); k < j; k++) {
          const trial = uniq.slice();
          const [moved] = trial.splice(j, 1);
          trial.splice(k, 0, moved);
          const was = moved.lateSms ?? false;
          moved.lateSms = true; // its stated balance is from when it was sent
          const nb = chain(trial);
          if (cost(nb) < cost(breaks) - 1) { uniq = trial; breaks = nb; improved = true; break outer; }
          moved.lateSms = was;
        }
      }
    }
    if (!improved) break;
    breaks = chain(uniq);
  }
  breaks = chain(uniq);
  opts.onProgress?.("checking", 100, 100);

  return {
    source: "cbe", title: "CBE transactions", balanceLabel: "CBE account balance",
    counts, duplicates, unknown, balanceBreaks: stripRefs(breaks), bonuses: [], loans: [], cancelled: [],
    transactions: uniq, linkedToTelebirr: linked, parserVersion: PARSER_VERSION,
  };
}
