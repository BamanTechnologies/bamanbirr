// Readers for text-based exports: JSON lines, PDF page text, Android XML backup.
import { localStamp } from "../util";
import type { SmsRecord, Source } from "../types";
import { DEFAULT_SENDERS } from "./chatdb";

/** JSON lines {sms_time|smsTime, text} — the format from the reference Python extractor. */
export function readJsonl(text: string, source: Source): SmsRecord[] {
  return text.split("\n").filter((l) => l.trim()).map((l) => {
    const r = JSON.parse(l);
    return { source, smsTime: r.smsTime ?? r.sms_time ?? null, text: r.text };
  });
}

/**
 * Join page texts. Some PDF extractors (pdf.js) return only the text visible on
 * each page, and a line cut by the page edge shows up at the end of one page AND
 * the start of the next. Drop that overlap: the longest run of lines ending page
 * i that also starts page i+1.
 */
export function stitchPages(pages: string[]): string {
  const out: string[] = [];
  for (const page of pages) {
    const lines = page.split("\n");
    let k = Math.min(out.length, lines.length, 40);
    for (; k > 0; k--) {
      let same = true;
      for (let j = 0; j < k; j++) if (out[out.length - k + j].trim() !== lines[j].trim()) { same = false; break; }
      if (same) break;
    }
    out.push(...lines.slice(k));
  }
  return out.join("\n");
}

const HEADER = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2}), (\d{4}) at (\d{1,2}):(\d{2})\s*([AP]M)/g;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Text of a Messages "Print to PDF" export, one string per page.
 * Messages repeats the whole conversation's text layer on every page, so
 * identical pages are kept once. Date headers ("Sep 10, 2025 at 1:44 PM")
 * become the arrival time of the messages that follow them.
 */
export function readPdfPages(pages: string[], source: Source): SmsRecord[] {
  const seen = new Set<string>();
  const uniq = pages.filter((p) => (seen.has(p) ? false : (seen.add(p), true)));
  const text = stitchPages(uniq);
  const records: SmsRecord[] = [];
  let last = 0;
  let current: string | null = null;
  const push = (chunk: string) => { if (chunk.trim()) records.push({ source, smsTime: current, text: chunk }); };
  for (const m of text.matchAll(HEADER)) {
    push(text.slice(last, m.index));
    let h = +m[4] % 12;
    if (m[6] === "PM") h += 12;
    current = localStamp(new Date(+m[3], MONTHS.indexOf(m[1]), +m[2], h, +m[5], 0));
    last = m.index! + m[0].length;
  }
  push(text.slice(last));
  return records;
}

function unescapeXml(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

/**
 * "SMS Backup & Restore" (Android) XML: <sms address="127" date="ms" type="1" body="…" />.
 * Only received messages (type 1) from the requested senders are kept.
 */
export function readAndroidXml(xml: string, sources: Source[], senders: Partial<Record<Source, string[]>> = {}): SmsRecord[] {
  const out: SmsRecord[] = [];
  const want = sources.map((s) => [s, (senders[s] ?? DEFAULT_SENDERS[s]).map((x) => x.toLowerCase())] as const);
  for (const m of xml.matchAll(/<sms\s([^>]*?)\/?>/g)) {
    const attrs: Record<string, string> = {};
    for (const a of m[1].matchAll(/(\w+)="([^"]*)"/g)) attrs[a[1]] = a[2];
    if (attrs.type && attrs.type !== "1") continue;
    const addr = unescapeXml(attrs.address ?? "").trim().toLowerCase().replace(/^\+/, "");
    // Exact sender only: a personal contact whose number merely ends in "127" must not match.
    const hit = want.find(([, ids]) => ids.some((id) => addr === id.replace(/^\+/, "")));
    if (!hit) continue;
    const date = attrs.date ? localStamp(new Date(+attrs.date)) : null;
    out.push({ source: hit[0], smsTime: date, text: unescapeXml(attrs.body ?? "") });
  }
  return out;
}
