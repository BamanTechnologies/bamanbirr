import { round2 } from "./util";
import type { BalanceBreak, Transaction } from "./types";

export type RefBreak = BalanceBreak & { ref: Transaction };

/** Signed balance effect of a transaction. */
export function signedTotal(t: Pick<Transaction, "direction" | "amount" | "fee" | "vat">): number {
  return t.direction === "out" ? round2(-(t.amount + t.fee + t.vat)) : round2(t.amount);
}

/**
 * Walk the transactions in order. Every stated balance must equal the previous
 * known balance plus everything since; transactions without a balance carry the
 * running figure forward. Mismatches are returned as breaks.
 */
export function chain(txs: Transaction[]): RefBreak[] {
  let running: number | null = null;
  const breaks: RefBreak[] = [];
  for (const t of txs) {
    t.balanceOk = null;
    if (running !== null) running = round2(running + t.total);
    if (t.balance !== null && !t.balanceAfterFee && !t.lateSms) {
      if (running !== null) {
        t.balanceOk = Math.abs(running - t.balance) < 0.015;
        if (!t.balanceOk)
          breaks.push({ txn: t.txn, datetime: t.datetime, kind: t.kind, expected: running, actual: t.balance,
            diff: round2(t.balance - running), ref: t });
      }
      running = t.balance;
    }
    t.balanceEst = running;
  }
  return breaks;
}

export const stripRefs = (b: RefBreak[]): BalanceBreak[] => b.map(({ ref: _ref, ...rest }) => rest);
