// The PDF route: pdf.js page text -> readPdfPages -> analyzeTelebirr must match the
// Python result for the same PDF (fixtures/127-2025.pdf, fixtures/pdf-transactions.json).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { analyzeTelebirr } from "../src";
import { readPdfPages } from "../src/readers";
import { pdfPages } from "./pdf";

const DIR = process.env.BAMANBIRR_FIXTURES ?? "";
const has = (f: string) => !!DIR && existsSync(join(DIR, f));

it.skipIf(!has("127-2025.pdf") || !has("pdf-transactions.json"))("PDF export matches the Python result", async () => {
  const pages = await pdfPages(new Uint8Array(readFileSync(join(DIR, "127-2025.pdf"))));
  const report = analyzeTelebirr(readPdfPages(pages, "telebirr"));
  const py = JSON.parse(readFileSync(join(DIR, "pdf-transactions.json"), "utf8"));
  expect(report.transactions.map((t) => [t.txn, t.kind, t.counterparty, t.total, t.balance]))
    .toEqual(py.transactions.map((t: any) => [t.txn, t.kind, t.counterparty, t.total, t.balance]));
  expect(report.balanceBreaks.length).toBe(0);
}, 60000);
