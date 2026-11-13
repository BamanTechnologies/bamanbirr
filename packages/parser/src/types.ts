/** Where a message came from. */
export type Source = "telebirr" | "cbe";

/** One SMS (or one message split out of an exported conversation). */
export interface SmsRecord {
  source: Source;
  /** When the phone received it, local time "YYYY-MM-DD HH:MM:SS"; null when unknown (e.g. plain PDF text). */
  smsTime: string | null;
  text: string;
}

export type Direction = "in" | "out";

export interface Transaction {
  source: Source;
  kind: string;
  direction: Direction;
  amount: number;
  fee: number;
  vat: number;
  /** Signed effect on the balance: −(amount+fee+vat) for out, +amount for in. */
  total: number;
  counterparty: string;
  account: string | null;
  /** Local time "YYYY-MM-DD HH:MM:SS". */
  datetime: string;
  /** True when the SMS text had no time and the arrival time was used. */
  timeFromSms: boolean;
  smsTime: string | null;
  txn: string | null;
  /** Balance stated in the SMS, if any. */
  balance: number | null;
  /** Running balance after this transaction (stated or carried forward). */
  balanceEst: number | null;
  balanceOk: boolean | null;
  receipt: string | null;
  message: string;
  /** Optional extras. */
  bankRef?: string | null;
  purpose?: string;
  foreign?: string | null;
  pairedTxn?: string | null;
  linkedTxn?: string | null;
  labelNote?: string;
  /** Internal ordering / checking hints. */
  rank?: number;
  balanceAfterFee?: boolean;
  lateSms?: boolean;
}

export interface BalanceBreak {
  txn: string | null;
  datetime: string;
  kind: string;
  expected: number;
  actual: number;
  diff: number;
}

export interface LoanApproved {
  contract: string;
  amount: number;
  facilitationFee: number;
  due: string;
  smsTime: string | null;
}

export interface SourceReport {
  source: Source;
  title: string;
  balanceLabel: string;
  /** Messages per category: tx, promo, verification, failed, notice, unknown_money, … */
  counts: Record<string, number>;
  duplicates: number;
  /** Messages that mention money but matched no known wording. */
  unknown: { smsTime: string | null; text: string }[];
  balanceBreaks: BalanceBreak[];
  bonuses: { amount: number; smsTime: string | null }[];
  loans: LoanApproved[];
  cancelled: { txn: string; amount: number; balance: number | null; smsTime: string | null }[];
  transactions: Transaction[];
  /** CBE only: how many entries were matched to the telebirr side. */
  linkedToTelebirr?: number;
  parserVersion: string;
}

/** A user rule that renames transactions the SMS can't identify. */
export interface LabelRule {
  source: Source;
  match: { counterparty?: string; date?: string };
  set: { counterparty?: string; kind?: string };
  note?: string;
}

export type Stage = "reading" | "filtering" | "parsing" | "checking" | "linking" | "done";
export type ProgressFn = (stage: Stage, done: number, total: number) => void;
