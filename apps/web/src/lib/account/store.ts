"use client";
// Account storage on Supabase. Every call runs as the signed-in user; row-level
// security means a user can only ever read or write their own rows.
//
// What is stored: only telebirr / CBE message text (never the original PDF or
// chat.db), immutable versioned analysis runs, and label rules.
import type { SupabaseClient } from "@supabase/supabase-js";
import { PARSER_VERSION, messageRows, type AnalysisResult, type LabelRule, type SmsRecord, type Source } from "@bamanbirr/parser";
import type { InputFormat } from "@/lib/analysis/protocol";

const enc = new TextEncoder();
async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
/**
 * One row per message, fingerprinted by the parser's dedupe rule (messageRows):
 * messages with their own reference dedupe by text across PDF / chat.db / XML;
 * the rest also use arrival date + occurrence, so identical SMS (e.g. repeated
 * remittance bonuses) are all kept.
 */
export async function toRows(records: SmsRecord[]) {
  const rows: { source: Source; sms_time: string | null; body: string; fingerprint: string }[] = [];
  for (const r of messageRows(records))
    rows.push({ source: r.source, sms_time: r.smsTime, body: r.body, fingerprint: await sha256(r.key) });
  return rows;
}

/** Save messages (idempotent). Returns how many were new. */
export async function saveMessages(sb: SupabaseClient, records: SmsRecord[], format: InputFormat, sources: Source[]): Promise<number> {
  const rows = await toRows(records);
  const { data: upload, error: e1 } = await sb.from("uploads").insert({ format, sources }).select("id").single();
  if (e1) throw e1;
  let added = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500).map((r) => ({ ...r, upload_id: upload.id }));
    const { data, error } = await sb.from("messages").upsert(chunk, { onConflict: "user_id,fingerprint", ignoreDuplicates: true }).select("id");
    if (error) throw error;
    added += data?.length ?? 0;
  }
  // Keep the upload log meaningful: an upload that added nothing new is removed again.
  if (added) await sb.from("uploads").update({ messages_added: added }).eq("id", upload.id);
  else await sb.from("uploads").delete().eq("id", upload.id);
  return added;
}

/** All saved messages of the user, oldest first. */
export async function loadMessages(sb: SupabaseClient): Promise<SmsRecord[]> {
  const out: SmsRecord[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from("messages").select("source, sms_time, body").order("sms_time", { ascending: true, nullsFirst: true }).order("id").range(from, from + 999);
    if (error) throw error;
    for (const m of data ?? []) out.push({ source: m.source, smsTime: m.sms_time ? String(m.sms_time).replace("T", " ").slice(0, 19) : null, text: m.body });
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function loadLabels(sb: SupabaseClient): Promise<LabelRule[]> {
  const { data, error } = await sb.from("labels").select("source, match, set, note").order("created_at");
  if (error) throw error;
  return (data ?? []).map((l) => ({ source: l.source, match: l.match, set: l.set, note: l.note ?? undefined }));
}

export interface RunSummary {
  [source: string]: { transactions: number; moneyIn: number; moneyOut: number; closing: number | null; gaps: number; from: string; to: string };
}

export function summarize(result: AnalysisResult): RunSummary {
  const s: RunSummary = {};
  for (const src of ["telebirr", "cbe"] as const) {
    const r = result[src];
    if (!r) continue;
    const tx = r.transactions;
    s[src] = {
      transactions: tx.length,
      moneyIn: tx.filter((t) => t.total > 0).reduce((a, t) => a + t.total, 0),
      moneyOut: -tx.filter((t) => t.total < 0).reduce((a, t) => a + t.total, 0),
      closing: tx.length ? tx[tx.length - 1].balanceEst : null,
      gaps: r.balanceBreaks.length,
      from: tx[0]?.datetime.slice(0, 10) ?? "",
      to: tx[tx.length - 1]?.datetime.slice(0, 10) ?? "",
    };
  }
  return s;
}

export interface RunRow {
  id: string;
  version: number;
  parser_version: string;
  sources: Source[];
  message_count: number;
  date_from: string | null;
  date_to: string | null;
  summary: RunSummary;
  created_at: string;
}

/**
 * Store an analysis of the user's whole message set as a new version.
 * If this exact message set was already analysed by this parser version, the
 * existing run is returned instead of creating a duplicate.
 */
export async function createRun(sb: SupabaseClient, records: SmsRecord[], result: AnalysisResult): Promise<{ id: string; version: number; reused: boolean }> {
  const fps = (await toRows(records)).map((r) => r.fingerprint).sort();
  const hash = await sha256(fps.join("\n"));
  const existing = await sb.from("runs").select("id, version").eq("parser_version", PARSER_VERSION).eq("message_set_hash", hash).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return { ...existing.data, reused: true };
  const summary = summarize(result);
  const days = Object.values(summary).flatMap((x) => [x.from, x.to]).filter(Boolean).sort();
  const { data, error } = await sb.from("runs").insert({
    parser_version: PARSER_VERSION,
    sources: Object.keys(result),
    message_set_hash: hash,
    message_count: fps.length,
    date_from: days[0] ?? null,
    date_to: days[days.length - 1] ?? null,
    summary,
    result,
  }).select("id, version").single();
  if (error) throw error;
  return { ...data, reused: false };
}

export async function listRuns(sb: SupabaseClient): Promise<RunRow[]> {
  const { data, error } = await sb.from("runs")
    .select("id, version, parser_version, sources, message_count, date_from, date_to, summary, created_at")
    .order("version", { ascending: false });
  if (error) throw error;
  return (data ?? []) as RunRow[];
}

export async function getRun(sb: SupabaseClient, id: string): Promise<RunRow & { result: AnalysisResult }> {
  const { data, error } = await sb.from("runs").select("*").eq("id", id).single();
  if (error) throw error;
  return data as RunRow & { result: AnalysisResult };
}

export async function deleteRun(sb: SupabaseClient, id: string) {
  const { error } = await sb.from("runs").delete().eq("id", id);
  if (error) throw error;
}

export async function countMessages(sb: SupabaseClient): Promise<Record<Source, number>> {
  const c = async (s: Source) => (await sb.from("messages").select("id", { count: "exact", head: true }).eq("source", s)).count ?? 0;
  return { telebirr: await c("telebirr"), cbe: await c("cbe") };
}

/** Remove every stored message, run, upload and label (the account itself stays). */
export async function deleteAllData(sb: SupabaseClient, userId: string) {
  for (const t of ["runs", "messages", "uploads", "labels"]) {
    const { error } = await sb.from(t).delete().eq("user_id", userId);
    if (error) throw error;
  }
}
