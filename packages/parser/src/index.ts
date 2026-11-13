import { analyzeTelebirr } from "./analyzeTelebirr";
import { analyzeCbe } from "./cbe";
import type { LabelRule, ProgressFn, SmsRecord, SourceReport } from "./types";

export * from "./types";
export { analyzeTelebirr } from "./analyzeTelebirr";
export { analyzeCbe, linkTelebirr, parseCbe } from "./cbe";
export { parseTelebirr } from "./telebirr";
export { splitMessages } from "./split";
export { messageRows, hasUniqueRef, normalizeText, type MessageRow } from "./rows";
export { applyLabels } from "./labels";
export { PARSER_VERSION } from "./util";

export interface AnalysisResult {
  telebirr?: SourceReport;
  cbe?: SourceReport;
}

/**
 * Analyse everything at once. telebirr runs first so CBE transfers can be
 * matched to their telebirr side.
 */
export function analyze(records: SmsRecord[], opts: { labels?: LabelRule[]; onProgress?: ProgressFn } = {}): AnalysisResult {
  const tele = records.filter((r) => r.source === "telebirr");
  const cbe = records.filter((r) => r.source === "cbe");
  const result: AnalysisResult = {};
  if (tele.length) result.telebirr = analyzeTelebirr(tele, opts);
  if (cbe.length) result.cbe = analyzeCbe(cbe, { ...opts, telebirr: result.telebirr?.transactions });
  opts.onProgress?.("done", 1, 1);
  return result;
}
