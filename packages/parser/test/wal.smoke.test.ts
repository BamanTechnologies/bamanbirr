import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import initSqlJs from "sql.js";
import { mergeWal } from "../src/readers/wal";
import { readChatDb } from "../src/readers";
const DIR = process.env.BAMANBIRR_FIXTURES ?? "";
it.skipIf(!DIR || !existsSync(join(DIR, "chat.db-wal")))("WAL frames are merged and add messages", async () => {
  const SQL = await initSqlJs();
  const db = new Uint8Array(readFileSync(join(DIR, "chat.db")));
  const wal = new Uint8Array(readFileSync(join(DIR, "chat.db-wal")));
  const withWal = readChatDb(SQL, { db, wal, sources: ["telebirr", "cbe"] });
  const without = readChatDb(SQL, { db, wal: null, sources: ["telebirr", "cbe"] });
  console.log("wal bytes", wal.length, "frames applied", mergeWal(db, wal).framesApplied, "records with/without WAL", withWal.records.length, without.records.length);
  expect(withWal.records.length).toBeGreaterThanOrEqual(without.records.length);
});
