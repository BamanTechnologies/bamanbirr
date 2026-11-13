// One stored row per bank SMS, with a dedupe key. The web app hashes `key`
// (SHA-256) into the message fingerprint; the database keeps one row per
// (user, fingerprint), so re-uploads never create duplicates.
import { splitMessages } from "./split";
import type { SmsRecord, Source } from "./types";

export interface MessageRow {
  source: Source;
  smsTime: string | null;
  /** Normalized message text (whitespace collapsed). */
  body: string;
  /** Pre-hash dedupe key; see messageRows(). */
  key: string;
}

export const normalizeText = (t: string) => t.replace(/\s+/g, " ").trim();

/**
 * True when the text identifies its own transaction: a telebirr transaction
 * number, a CBE FT reference, or its own date and time with seconds.
 */
export function hasUniqueRef(body: string): boolean {
  return (
    /transaction number (?:is\s*)?[A-Z0-9]{10}/.test(body) ||
    /\bFT[0-9A-Z]{10}/.test(body) ||
    /\b\d{2}\/\d{2}\/\d{4}(?: at)? \d{2}:\d{2}:\d{2}\b/.test(body) ||
    /\b\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\b/.test(body)
  );
}

/**
 * Split records into single messages and give each a dedupe key:
 * - text with a unique reference: source + text, so the same SMS dedupes
 *   across PDF / chat.db / XML;
 * - anything else (e.g. "You have got ETB 50.00 bonus for receiving
 *   Remittance"): source + text + arrival date + occurrence of that identical
 *   text on that date (1, 2, … in arrival order). Exact arrival times differ by
 *   format (PDF minute headers, chat.db seconds, XML ms), so only the date is used.
 */
export function messageRows(records: SmsRecord[]): MessageRow[] {
  const ordered = records
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      const x = a.r.smsTime ?? "", y = b.r.smsTime ?? "";
      return x < y ? -1 : x > y ? 1 : a.i - b.i;
    })
    .map(({ r }) => r);
  const rows: MessageRow[] = [];
  const seen = new Set<string>();
  const occurrences = new Map<string, number>();
  for (const r of ordered) {
    const parts = splitMessages(r.text);
    for (const part of parts.length ? parts : [r.text]) {
      const body = normalizeText(part);
      let key = `${r.source}\n${body}`;
      if (!hasUniqueRef(body)) {
        const sameDay = `${key}\n${r.smsTime?.slice(0, 10) ?? ""}`;
        const n = (occurrences.get(sameDay) ?? 0) + 1;
        occurrences.set(sameDay, n);
        key = `${sameDay}\n${n}`;
      }
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ source: r.source, smsTime: r.smsTime, body, key });
    }
  }
  return rows;
}
