import type { AnalysisResult, LabelRule, SmsRecord, Source } from "@bamanbirr/parser";

export type InputFormat = "pdf" | "chatdb" | "xml";
export type JobFormat = InputFormat | "records";

/** What the page sends to the analysis worker. Files are read on the page; bytes/text are transferred. */
export type Job =
  | { format: "pdf"; sources: Source[]; pages: { source: Source; pages: string[] }[]; labels?: LabelRule[] }
  | { format: "chatdb"; sources: Source[]; db: ArrayBuffer; wal: ArrayBuffer | null; labels?: LabelRule[] }
  | { format: "xml"; sources: Source[]; xml: string; labels?: LabelRule[] }
  /** Re-analyse messages already saved to the account. */
  | { format: "records"; sources: Source[]; records: SmsRecord[]; labels?: LabelRule[] };

export type StageId = "reading" | "filtering" | "parsing" | "checking" | "linking" | "building";

export type WorkerMessage =
  | { type: "progress"; stage: StageId; done: number; total: number; note?: string }
  | { type: "result"; result: AnalysisResult; found: Record<Source, number>; records: SmsRecord[]; walFrames?: number }
  | { type: "error"; message: string };

export const STAGES: { id: StageId; label: string }[] = [
  { id: "reading", label: "Reading your file" },
  { id: "filtering", label: "Finding telebirr and CBE messages" },
  { id: "parsing", label: "Understanding each message" },
  { id: "checking", label: "Checking every balance" },
  { id: "linking", label: "Linking CBE and telebirr transfers" },
  { id: "building", label: "Building your report" },
];
