// Merge a SQLite write-ahead log (chat.db-wal) into the main database bytes.
//
// In-memory SQLite builds (sql.js, wasm) can't open a WAL file, but the newest
// messages often live only there. The WAL format is simple: a 32-byte header,
// then frames of [24-byte header + one page]. A frame belongs to the current
// WAL when its salts match the header and its running checksum is valid; pages
// up to the last *commit* frame (one with a non-zero "db size") are applied.
// Spec: https://www.sqlite.org/fileformat2.html#walformat

function checksum(data: DataView, offset: number, length: number, s0: number, s1: number, bigEndian: boolean): [number, number] {
  for (let i = offset; i < offset + length; i += 8) {
    const x0 = data.getUint32(i, !bigEndian);
    const x1 = data.getUint32(i + 4, !bigEndian);
    s0 = (s0 + x0 + s1) >>> 0;
    s1 = (s1 + x1 + s0) >>> 0;
  }
  return [s0, s1];
}

export interface WalMergeResult {
  bytes: Uint8Array;
  framesApplied: number;
}

export function mergeWal(db: Uint8Array, wal: Uint8Array | null | undefined): WalMergeResult {
  // Always make a copy we can modify; mark the file as rollback-journal mode
  // (header bytes 18-19 = 1) so in-memory SQLite doesn't look for a WAL.
  const out0 = new Uint8Array(db);
  const markLegacy = (b: Uint8Array) => { if (b.length > 19) { b[18] = 1; b[19] = 1; } return b; };
  if (!wal || wal.length < 32) return { bytes: markLegacy(out0), framesApplied: 0 };

  const w = new DataView(wal.buffer, wal.byteOffset, wal.byteLength);
  const magic = w.getUint32(0, false);
  if (magic !== 0x377f0682 && magic !== 0x377f0683) return { bytes: markLegacy(out0), framesApplied: 0 };
  const bigEndian = magic === 0x377f0683;
  const pageSize = w.getUint32(8, false) || 65536;
  const salt1 = w.getUint32(16, false);
  const salt2 = w.getUint32(20, false);
  let [s0, s1] = checksum(w, 0, 24, 0, 0, bigEndian);
  if (s0 !== w.getUint32(24, false) || s1 !== w.getUint32(28, false)) return { bytes: markLegacy(out0), framesApplied: 0 };

  const frameSize = 24 + pageSize;
  const pending = new Map<number, number>(); // page number -> frame offset (latest wins)
  const committed = new Map<number, number>();
  let dbPages = Math.ceil(out0.length / pageSize);
  let framesApplied = 0;
  for (let off = 32; off + frameSize <= wal.length; off += frameSize) {
    if (w.getUint32(off + 8, false) !== salt1 || w.getUint32(off + 12, false) !== salt2) break;
    [s0, s1] = checksum(w, off, 8, s0, s1, bigEndian);
    [s0, s1] = checksum(w, off + 24, pageSize, s0, s1, bigEndian);
    if (s0 !== w.getUint32(off + 16, false) || s1 !== w.getUint32(off + 20, false)) break;
    const pageNo = w.getUint32(off, false);
    const commitSize = w.getUint32(off + 4, false);
    pending.set(pageNo, off + 24);
    if (commitSize !== 0) {
      for (const [p, o] of pending) committed.set(p, o);
      pending.clear();
      dbPages = commitSize;
      framesApplied = committed.size;
    }
  }
  if (!committed.size) return { bytes: markLegacy(out0), framesApplied: 0 };

  const out = new Uint8Array(dbPages * pageSize);
  out.set(out0.subarray(0, Math.min(out0.length, out.length)));
  for (const [p, o] of committed) if (p >= 1 && p <= dbPages) out.set(wal.subarray(o, o + pageSize), (p - 1) * pageSize);
  return { bytes: markLegacy(out), framesApplied };
}
