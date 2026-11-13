// Golden tests: the TypeScript parser must reproduce the Python reference
// results on real exported data. The data is personal, so it is NOT in the
// repo: point BAMANBIRR_FIXTURES at a folder containing
//   127.jsonl, cbe.jsonl            (messages, from the Python extractor)
//   transactions.json, cbe.json     (Python results)
//   labels.json                     (optional, the label rules used)
//   chat.db [+ chat.db-wal]         (optional, to test the chat.db reader)
// Run with TZ set to the zone the Python ran in (e.g. TZ=Africa/Addis_Ababa).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import initSqlJs from "sql.js";
import { analyzeCbe, analyzeTelebirr, type LabelRule, type SourceReport, type Transaction } from "../src";
import { readChatDb, readJsonl } from "../src/readers";

const DIR = process.env.BAMANBIRR_FIXTURES ?? "";
const has = (f: string) => !!DIR && existsSync(join(DIR, f));
const load = (f: string) => JSON.parse(readFileSync(join(DIR, f), "utf8"));
const text = (f: string) => readFileSync(join(DIR, f), "utf8");

const near = (a: number | null, b: number | null) => (a === null || b === null ? a === b : Math.abs(a - b) < 0.011);

function compare(ts: SourceReport, py: any) {
  expect(ts.transactions.length).toBe(py.transactions.length);
  const diffs: string[] = [];
  ts.transactions.forEach((t: Transaction, i: number) => {
    const p = py.transactions[i];
    const pairs: [string, unknown, unknown, boolean][] = [
      ["kind", t.kind, p.kind, t.kind === p.kind],
      ["direction", t.direction, p.direction, t.direction === p.direction],
      ["counterparty", t.counterparty, p.counterparty, t.counterparty === p.counterparty],
      ["account", t.account, p.account, (t.account ?? null) === (p.account ?? null)],
      ["datetime", t.datetime, p.datetime, t.datetime === p.datetime],
      ["txn", t.txn, p.txn, t.txn === p.txn],
      ["amount", t.amount, p.amount, near(t.amount, p.amount)],
      ["fee", t.fee, p.fee, near(t.fee, p.fee)],
      ["vat", t.vat, p.vat, near(t.vat, p.vat)],
      ["total", t.total, p.total, near(t.total, p.total)],
      ["balance", t.balance, p.balance, near(t.balance, p.balance)],
      ["balanceEst", t.balanceEst, p.balance_est, near(t.balanceEst, p.balance_est)],
      ["receipt", t.receipt, p.receipt, (t.receipt ?? null) === (p.receipt ?? null)],
      ["message", t.message, p.message, t.message === p.message],
    ];
    for (const [k, a, b, ok] of pairs) if (!ok && diffs.length < 15) diffs.push(`#${i} ${k}: ts=${JSON.stringify(a)} py=${JSON.stringify(b)}`);
  });
  expect(diffs).toEqual([]);
  expect(ts.balanceBreaks.map((b) => [b.datetime, b.diff])).toEqual(py.balance_breaks.map((b: any) => [b.datetime, b.diff]));
  expect(ts.counts).toEqual(py.counts);
  expect(ts.duplicates).toBe(py.duplicates);
}

const labels: LabelRule[] = has("labels.json")
  ? load("labels.json").rules.map((r: any) => ({ ...r, source: String(r.source).toLowerCase() }))
  : [];

describe.skipIf(!has("127.jsonl") || !has("transactions.json"))("telebirr matches the Python reference", () => {
  it("produces identical transactions, balances and gaps", () => {
    const report = analyzeTelebirr(readJsonl(text("127.jsonl"), "telebirr"), { labels });
    compare(report, load("transactions.json"));
  });
});

describe.skipIf(!has("cbe.jsonl") || !has("cbe.json") || !has("127.jsonl"))("CBE matches the Python reference", () => {
  it("produces identical transactions, links, labels and gaps", () => {
    const tele = analyzeTelebirr(readJsonl(text("127.jsonl"), "telebirr"), { labels });
    const report = analyzeCbe(readJsonl(text("cbe.jsonl"), "cbe"), { telebirr: tele.transactions, labels });
    compare(report, load("cbe.json"));
  });
});

describe.skipIf(!has("chat.db") || !has("127.jsonl") || !has("cbe.jsonl"))("chat.db reader matches Python's SQLite", () => {
  it("extracts the same telebirr and CBE messages (incl. the WAL)", async () => {
    const SQL = await initSqlJs();
    const db = new Uint8Array(readFileSync(join(DIR, "chat.db")));
    const wal = has("chat.db-wal") ? new Uint8Array(readFileSync(join(DIR, "chat.db-wal"))) : null;
    const { records, walFrames } = readChatDb(SQL, { db, wal, sources: ["telebirr", "cbe"] });
    for (const [src, file] of [["telebirr", "127.jsonl"], ["cbe", "cbe.jsonl"]] as const) {
      const got = records.filter((r) => r.source === src);
      const want = readJsonl(text(file), src);
      expect(got.length, `${src} count (wal frames applied: ${walFrames})`).toBe(want.length);
      const textDiffs = got.filter((r, i) => r.text !== want[i].text).length;
      const timeDiffs = got.filter((r, i) => r.smsTime !== want[i].smsTime).length;
      expect(textDiffs).toBe(0);
      expect(timeDiffs).toBe(0);
    }
  });
});
