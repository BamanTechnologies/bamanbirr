/// <reference lib="webworker" />
// Runs the parser off the main thread so the page stays responsive and can
// show real progress. Nothing here touches the network except loading the
// SQLite wasm file from our own site.
import { analyzeCbe, analyzeTelebirr, type AnalysisResult, type SmsRecord, type Source } from "@bamanbirr/parser";
import { readAndroidXml, readChatDb, readPdfPages } from "@bamanbirr/parser/readers";
import initSqlJs from "sql.js";
import type { Job, StageId, WorkerMessage } from "./protocol";

const post = (m: WorkerMessage) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m);
const progress = (stage: StageId, done: number, total: number, note?: string) => post({ type: "progress", stage, done, total, note });

self.onmessage = async (e: MessageEvent<Job>) => {
  const job = e.data;
  try {
    // 1. Turn the input into SMS records for the chosen sources only.
    progress("filtering", 0, 1);
    let records: SmsRecord[] = [];
    let walFrames: number | undefined;
    if (job.format === "pdf") {
      for (const p of job.pages) records.push(...readPdfPages(p.pages, p.source));
    } else if (job.format === "chatdb") {
      const SQL = await initSqlJs({ locateFile: (f: string) => `/vendor/${f}` });
      const out = readChatDb(SQL, { db: new Uint8Array(job.db), wal: job.wal ? new Uint8Array(job.wal) : null, sources: job.sources });
      records = out.records;
      walFrames = out.walFrames;
    } else if (job.format === "xml") {
      records = readAndroidXml(job.xml, job.sources);
    } else {
      records = job.records;
    }
    const found: Record<Source, number> = {
      telebirr: records.filter((r) => r.source === "telebirr").length,
      cbe: records.filter((r) => r.source === "cbe").length,
    };
    progress("filtering", 1, 1, `${(found.telebirr + found.cbe).toLocaleString("en-US")} messages found`);

    // 2. Parse, check balances, link.
    const result: AnalysisResult = {};
    const tele = records.filter((r) => r.source === "telebirr");
    const cbe = records.filter((r) => r.source === "cbe");
    const onProgress = (stage: string, done: number, total: number) => {
      if (stage === "parsing" || stage === "checking" || stage === "linking") progress(stage, done, total);
    };
    if (job.sources.includes("telebirr") && tele.length) result.telebirr = analyzeTelebirr(tele, { labels: job.labels, onProgress });
    if (job.sources.includes("cbe") && cbe.length)
      result.cbe = analyzeCbe(cbe, { labels: job.labels, telebirr: result.telebirr?.transactions, onProgress });
    progress("linking", 1, 1);
    progress("building", 1, 1);
    post({ type: "result", result, found, records, walFrames });
  } catch (err) {
    post({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
