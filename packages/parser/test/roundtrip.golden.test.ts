// Saving must not change the report: records -> messageRows (what the web app
// stores, one row per fingerprint) -> records loaded back -> re-analysis has to
// give the same transactions, totals, gaps and closing balances as analysing
// the original records. Runs on the personal fixtures (see golden.test.ts).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import initSqlJs from "sql.js";
import { analyze, messageRows, type AnalysisResult, type SmsRecord } from "../src";
import { readChatDb, readPdfPages } from "../src/readers";
import { pdfPages } from "./pdf";

const DIR = process.env.BAMANBIRR_FIXTURES ?? "";
const has = (f: string) => !!DIR && existsSync(join(DIR, f));

/**
 * The database: upserts keep the first row per (user, fingerprint) across
 * uploads; loadMessages() reads them back by sms_time (nulls first), then id.
 */
function storeAndLoad(...uploads: SmsRecord[][]): SmsRecord[] {
  const table = new Map<string, { id: number; source: SmsRecord["source"]; smsTime: string | null; body: string }>();
  for (const records of uploads)
    for (const r of messageRows(records))
      if (!table.has(r.key)) table.set(r.key, { id: table.size, source: r.source, smsTime: r.smsTime, body: r.body });
  return [...table.values()]
    .sort((a, b) => {
      const x = a.smsTime, y = b.smsTime;
      if (x !== y) return x === null ? -1 : y === null ? 1 : x < y ? -1 : 1;
      return a.id - b.id;
    })
    .map((m) => ({ source: m.source, smsTime: m.smsTime, text: m.body }));
}

const r2 = (n: number) => Math.round(n * 100) / 100;
function summary(res: AnalysisResult) {
  return Object.fromEntries((["telebirr", "cbe"] as const).filter((s) => res[s]).map((src) => {
    const r = res[src];
    const tx = r!.transactions;
    return [src, {
      transactions: tx.length,
      moneyIn: r2(tx.filter((t) => t.total > 0).reduce((a, t) => a + t.total, 0)),
      moneyOut: r2(tx.filter((t) => t.total < 0).reduce((a, t) => a + t.total, 0)),
      closing: tx.at(-1)?.balanceEst ?? null,
      gaps: r!.balanceBreaks.map((b) => [b.datetime, b.diff]),
      linked: r!.linkedToTelebirr ?? null,
      remittanceBonuses: tx.filter((t) => t.kind === "Remittance bonus").length,
    }];
  }));
}

async function chatDb(withWal: boolean) {
  const SQL = await initSqlJs();
  const db = new Uint8Array(readFileSync(join(DIR, "chat.db")));
  const wal = withWal && has("chat.db-wal") ? new Uint8Array(readFileSync(join(DIR, "chat.db-wal"))) : null;
  return readChatDb(SQL, { db, wal, sources: ["telebirr", "cbe"] }).records;
}

describe.skipIf(!has("chat.db"))("saving keeps the report identical (chat.db)", () => {
  it("re-analysing the stored messages gives the same totals and balances", async () => {
    const records = await chatDb(true);
    const before = summary(analyze(records));
    const after = summary(analyze(storeAndLoad(records)));
    expect(after).toEqual(before);
    expect(before.telebirr.remittanceBonuses).toBeGreaterThan(0);
  });

  it("saving again, or saving the older chat.db first, adds nothing twice", async () => {
    const full = await chatDb(true);
    const older = await chatDb(false);
    const want = summary(analyze(full));
    expect(summary(analyze(storeAndLoad(full, full)))).toEqual(want);
    expect(summary(analyze(storeAndLoad(older, full)))).toEqual(want);
  });
});

describe.skipIf(!has("127-2025.pdf"))("saving keeps the report identical (PDF)", () => {
  it("re-analysing the stored messages gives the same totals and balances", async () => {
    const records = readPdfPages(await pdfPages(new Uint8Array(readFileSync(join(DIR, "127-2025.pdf")))), "telebirr");
    expect(summary(analyze(storeAndLoad(records)))).toEqual(summary(analyze(records)));
  }, 60000);

  it.skipIf(!has("chat.db"))("the same SMS from a PDF and from chat.db is stored once", async () => {
    const pdf = readPdfPages(await pdfPages(new Uint8Array(readFileSync(join(DIR, "127-2025.pdf")))), "telebirr");
    const full = await chatDb(true);
    expect(summary(analyze(storeAndLoad(pdf, full)))).toEqual(summary(analyze(full)));
  }, 60000);
});
