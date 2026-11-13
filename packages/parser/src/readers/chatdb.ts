// Read telebirr / CBE SMS out of a Mac Messages database (chat.db) or an
// iPhone backup's sms.db. Only messages from the requested senders are kept;
// the rest of the database is never returned.
import type { Database, SqlJsStatic } from "sql.js";
import { localStamp } from "../util";
import type { SmsRecord, Source } from "../types";
import { mergeWal } from "./wal";

export const DEFAULT_SENDERS: Record<Source, string[]> = { telebirr: ["127"], cbe: ["CBE"] };

/** Newer macOS keeps many texts only in attributedBody (NSArchiver typedstream). */
export function decodeAttributedBody(blob: Uint8Array | null): string | null {
  if (!blob) return null;
  const marker = new TextEncoder().encode("NSString");
  let i = -1;
  outer: for (let k = 0; k <= blob.length - marker.length; k++) {
    for (let j = 0; j < marker.length; j++) if (blob[k + j] !== marker[j]) continue outer;
    i = k; break;
  }
  if (i < 0) return null;
  const b = blob.subarray(i + marker.length + 5);
  if (!b.length) return null;
  let n: number, start: number;
  if (b[0] === 0x81) { n = b[1] | (b[2] << 8); start = 3; }
  else if (b[0] === 0x82) { n = (b[1] | (b[2] << 8) | (b[3] << 16) | (b[4] << 24)) >>> 0; start = 5; }
  else { n = b[0]; start = 1; }
  return new TextDecoder("utf-8", { fatal: false }).decode(b.subarray(start, start + n));
}

/** Apple stores message dates as seconds (old) or nanoseconds (new) since 2001-01-01. */
export function appleDateToLocal(date: number | bigint): string {
  const d = Number(date);
  const secs = d > 1e11 ? d / 1e9 : d;
  return localStamp(new Date((secs + 978307200) * 1000));
}

export interface ChatDbInput {
  db: Uint8Array;
  wal?: Uint8Array | null;
  sources: Source[];
  senders?: Partial<Record<Source, string[]>>;
}

export function readChatDb(SQL: SqlJsStatic, input: ChatDbInput): { records: SmsRecord[]; walFrames: number } {
  const { bytes, framesApplied } = mergeWal(input.db, input.wal);
  const db: Database = new SQL.Database(bytes);
  try {
    const records: SmsRecord[] = [];
    for (const source of input.sources) {
      const ids = input.senders?.[source] ?? DEFAULT_SENDERS[source];
      for (const id of ids) {
        const stmt = db.prepare(
          `SELECT m.date, m.text, m.attributedBody FROM message m JOIN handle h ON m.handle_id = h.ROWID
           WHERE lower(ltrim(h.id, '+')) = lower(?) ORDER BY m.date`,
        );
        // Exact sender only: a personal contact whose number merely ends in "127" must not match.
        stmt.bind([id.replace(/^\+/, "")]);
        while (stmt.step()) {
          const [date, text, body] = stmt.get() as [number, string | null, Uint8Array | null];
          const t = text || decodeAttributedBody(body);
          if (!t) continue;
          records.push({ source, smsTime: appleDateToLocal(date), text: t.trim() });
        }
        stmt.free();
      }
    }
    return { records, walFrames: framesApplied };
  } finally {
    db.close();
  }
}
