"use client";
// Orchestrates an analysis on the user's device: reads the files, extracts PDF
// text page by page (pdf.js), then hands everything to the worker.
import type { AnalysisResult, LabelRule, SmsRecord, Source } from "@bamanbirr/parser";
import type { InputFormat, Job, StageId, WorkerMessage } from "./protocol";

export interface RunInput {
  format: InputFormat;
  sources: Source[];
  /** pdf: one file per source; chatdb: chat.db (+ -wal, -shm); xml: one file */
  files: { pdf?: Partial<Record<Source, File>>; db?: File; wal?: File | null; xml?: File };
  labels?: LabelRule[];
}

export interface RunOutput {
  result: AnalysisResult;
  /** The telebirr / CBE messages that were analysed (for saving to an account). */
  records: SmsRecord[];
  found: Record<Source, number>;
  walFrames?: number;
}

export type OnProgress = (stage: StageId, done: number, total: number, note?: string) => void;

async function pdfPages(file: File, onPage: (done: number, total: number) => void): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.min.mjs";
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    pages.push(content.items.map((it) => ("str" in it ? it.str + (it.hasEOL ? "\n" : "") : "")).join(""));
    onPage(i, doc.numPages);
  }
  await doc.destroy();
  return pages;
}

export async function runAnalysis(input: RunInput, onProgress: OnProgress): Promise<RunOutput> {
  onProgress("reading", 0, 1);
  let job: Job;
  const transfer: Transferable[] = [];
  if (input.format === "pdf") {
    const list = input.sources.map((s) => [s, input.files.pdf?.[s]] as const).filter(([, f]) => f) as [Source, File][];
    let pageTotal = 0;
    const pages: { source: Source; pages: string[] }[] = [];
    for (const [source, file] of list) {
      const p = await pdfPages(file, (d, t) => onProgress("reading", pageTotal + d, pageTotal + t, `Page ${d} of ${t}`));
      pageTotal += p.length;
      pages.push({ source, pages: p });
    }
    job = { format: "pdf", sources: input.sources, pages };
  } else if (input.format === "chatdb") {
    if (!input.files.db) throw new Error("Please add chat.db");
    const db = await input.files.db.arrayBuffer();
    const wal = input.files.wal ? await input.files.wal.arrayBuffer() : null;
    transfer.push(db);
    if (wal) transfer.push(wal);
    job = { format: "chatdb", sources: input.sources, db, wal };
  } else {
    if (!input.files.xml) throw new Error("Please add your backup file");
    job = { format: "xml", sources: input.sources, xml: await input.files.xml.text() };
  }
  job.labels = input.labels;
  onProgress("reading", 1, 1);
  return runJob(job, transfer, onProgress);
}

/** Analyse messages that are already in memory (e.g. loaded from the account). */
export function analyzeRecords(records: SmsRecord[], sources: Source[], labels: LabelRule[] | undefined, onProgress: OnProgress) {
  return runJob({ format: "records", sources, records, labels }, [], onProgress);
}

async function runJob(job: Job, transfer: Transferable[], onProgress: OnProgress): Promise<RunOutput> {
  const worker = new Worker(new URL("./analysis.worker.ts", import.meta.url), { type: "module" });
  try {
    return await new Promise<RunOutput>((resolve, reject) => {
      worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
        const m = e.data;
        if (m.type === "progress") onProgress(m.stage, m.done, m.total, m.note);
        else if (m.type === "result") resolve({ result: m.result, found: m.found, records: m.records, walFrames: m.walFrames });
        else reject(new Error(m.message));
      };
      worker.onerror = (e) => reject(new Error(e.message || "The analysis stopped unexpectedly."));
      worker.postMessage(job, transfer);
    });
  } finally {
    worker.terminate();
  }
}
