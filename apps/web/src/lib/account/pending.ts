"use client";
// Holds an unsaved analysis in this browser (IndexedDB) while the user signs in,
// so "Save report" can finish afterwards. Nothing leaves the device until then,
// and the entry is removed once saved (or after 24 hours).
import type { SmsRecord, Source } from "@bamanbirr/parser";
import type { InputFormat } from "@/lib/analysis/protocol";

export interface Pending {
  records: SmsRecord[];
  format: InputFormat;
  sources: Source[];
  createdAt: number;
}

const DB = "bamanbirr", STORE = "pending", KEY = "save";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const putPending = (p: Omit<Pending, "createdAt">) => tx("readwrite", (s) => s.put({ ...p, createdAt: Date.now() }, KEY));
export async function getPending(): Promise<Pending | null> {
  try {
    const p = (await tx<Pending | undefined>("readonly", (s) => s.get(KEY))) ?? null;
    if (p && Date.now() - p.createdAt > 24 * 3600e3) { await clearPending(); return null; }
    return p;
  } catch { return null; }
}
export const clearPending = () => tx("readwrite", (s) => s.delete(KEY)).catch(() => undefined);
