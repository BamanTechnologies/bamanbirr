import type { SourceReport, Transaction } from "@bamanbirr/parser";

export interface Tx extends Transaction {
  d: Date;
  day: string;
  hour: number;
  wday: number;
  bal: number | null;
}

export type Group = "day" | "week" | "month";
export type Dir = "all" | "in" | "out";
export type Tod = "all" | "morning" | "afternoon" | "evening" | "night";
export type Preset = "all" | "7" | "30" | "90" | "365" | "custom";

export interface Filters {
  preset: Preset;
  from: string;
  to: string;
  group: Group;
  dir: Dir;
  person: string;
  tod: Tod;
  wd: string; // all | weekday | weekend | 0..6
  types: Set<string>;
}

export const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmt0 = (n: number) => Math.round(n).toLocaleString("en-US");
export const sgn = (n: number) => (n < 0 ? "−" : "+") + fmt(Math.abs(n));
export const sum = <T,>(a: T[], f: (x: T) => number) => a.reduce((s, x) => s + f(x), 0);

const pad = (n: number) => String(n).padStart(2, "0");
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const addDays = (s: string, n: number) => { const d = new Date(s + "T00:00"); d.setDate(d.getDate() + n); return ymd(d); };
export const niceDay = (s: string) => { const d = new Date(s + "T00:00"); return `${d.getDate()} ${MON[d.getMonth()]}`; };
export const daysBetween = (a: string, b: string) => Math.round((new Date(b + "T00:00").getTime() - new Date(a + "T00:00").getTime()) / 864e5);

export function enrich(report: SourceReport): Tx[] {
  return report.transactions
    .filter((t) => t.datetime)
    .map((t) => {
      const d = new Date(t.datetime.replace(" ", "T"));
      return { ...t, d, day: t.datetime.slice(0, 10), hour: d.getHours(), wday: d.getDay(), bal: t.balanceEst ?? t.balance };
    });
}

export function autoGroup(from: string, to: string): Group {
  const nd = daysBetween(from, to);
  return nd > 120 ? "month" : nd > 31 ? "week" : "day";
}

export function initialFilters(tx: Tx[]): Filters {
  const from = tx[0]?.day ?? ymd(new Date());
  const to = tx[tx.length - 1]?.day ?? from;
  return { preset: "all", from, to, group: autoGroup(from, to), dir: "all", person: "", tod: "all", wd: "all", types: new Set(tx.map((t) => t.kind)) };
}

const todOk = (f: Filters, h: number) =>
  f.tod === "all" || (f.tod === "morning" && h >= 6 && h < 12) || (f.tod === "afternoon" && h >= 12 && h < 18) ||
  (f.tod === "evening" && h >= 18) || (f.tod === "night" && h < 6);
const wdOk = (f: Filters, w: number) =>
  f.wd === "all" || (f.wd === "weekday" && w >= 1 && w <= 5) || (f.wd === "weekend" && (w === 0 || w === 6)) || String(w) === f.wd;

export function applyFilters(tx: Tx[], f: Filters, ignorePerson = false): Tx[] {
  return tx.filter((t) =>
    t.day >= f.from && t.day <= f.to && (f.dir === "all" || t.direction === f.dir) && f.types.has(t.kind) &&
    (ignorePerson || !f.person || t.counterparty === f.person) && todOk(f, t.hour) && wdOk(f, t.wday));
}

export function bucketKey(day: string, g: Group): string {
  if (g === "day") return day;
  if (g === "month") return day.slice(0, 7);
  const d = new Date(day + "T00:00");
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return ymd(d);
}
export function bucketLabel(k: string, g: Group, short = false): string {
  if (g === "day") return niceDay(k);
  if (g === "month") { const [y, m] = k.split("-"); return `${MON[+m - 1]} ${short ? y.slice(2) : y}`; }
  return (short ? "" : "Week of ") + niceDay(k);
}
export function bucketsInRange(f: Filters): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (let d = f.from; d <= f.to; d = addDays(d, 1)) {
    const k = bucketKey(d, f.group);
    if (!seen.has(k)) { seen.add(k); out.push(k); }
  }
  return out;
}

export interface Grouped { name: string; v: number; n: number }
export function groupBy(rows: Tx[], key: (t: Tx) => string, val: (t: Tx) => number): Grouped[] {
  const m = new Map<string, Grouped>();
  for (const t of rows) {
    const k = key(t);
    const o = m.get(k) ?? { name: k, v: 0, n: 0 };
    o.v += val(t); o.n++; m.set(k, o);
  }
  return [...m.values()].sort((a, b) => b.v - a.v);
}

export interface PersonRow { name: string; n: number; sent: number; recv: number; fees: number; net: number; total: number; last: string; account: string | null }
export function people(rows: Tx[]): PersonRow[] {
  const m = new Map<string, PersonRow>();
  for (const t of rows) {
    const o = m.get(t.counterparty) ?? { name: t.counterparty, n: 0, sent: 0, recv: 0, fees: 0, net: 0, total: 0, last: t.datetime, account: t.account };
    if (t.direction === "out") o.sent += t.amount; else o.recv += t.amount;
    o.fees += t.fee + t.vat; o.n++;
    if (t.datetime > o.last) o.last = t.datetime;
    m.set(t.counterparty, o);
  }
  return [...m.values()].map((o) => ({ ...o, net: o.recv - o.sent - o.fees, total: o.sent + o.recv }));
}
