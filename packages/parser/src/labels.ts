import type { LabelRule, Source, Transaction } from "./types";

/** Apply the user's labelling rules (e.g. "Unspecified credit in 2026-07" -> "Remittance app"). */
export function applyLabels(txs: Transaction[], source: Source, rules: LabelRule[] = []): number {
  let n = 0;
  for (const rule of rules) {
    if ((rule.source ?? source).toLowerCase() !== source.toLowerCase()) continue;
    const m = rule.match ?? {};
    for (const t of txs) {
      if (m.counterparty !== undefined && t.counterparty !== m.counterparty) continue;
      if (m.date !== undefined && !(t.datetime ?? "").startsWith(m.date)) continue;
      if (rule.set.counterparty !== undefined) t.counterparty = rule.set.counterparty;
      if (rule.set.kind !== undefined) t.kind = rule.set.kind;
      if (rule.note) t.labelNote = rule.note;
      n++;
    }
  }
  return n;
}
