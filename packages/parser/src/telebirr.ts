// telebirr (sender 127) SMS patterns. Ported 1:1 from the Python reference
// (rag-starter/telebirr-scanner/sms/parse_sms.py). Pattern ORDER matters: the
// first match wins, so more specific wordings come before generic ones.
import { cleanName, dt, merchant, num } from "./util";
import type { Direction, LoanApproved } from "./types";

const R = (s: string) => new RegExp(s);
const AMT = String.raw`ETB\s*([\d,]+(?:\.\d{1,2})?)`;
const DMY = String.raw`(\d{2}/\d{2}/\d{4} \d{2}:\d{2}:\d{2})`;
const YMD = String.raw`(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})`;
const PHONE = String.raw`\(((?:251)?\d{1,4}\*+\d{2,4})\)`;
const FEE = R(String.raw`service fee is\s*ETB\s*([\d,]+\.\d{2})\s*and\s*15% VAT on the service fee is\s*ETB\s*([\d,]+\.\d{2})`);
const FEE_ONLY = R(String.raw`service fee is\s*ETB\s*([\d,]+\.\d{2})`);
const BAL = R(String.raw`balance is\s*ETB\s*([\d,]+\.\d{2})`);
const TXN = R(String.raw`(?:telebirr )?transaction number is\s*([A-Z0-9]{10})`);

/** Fields a pattern produces; the analyzer fills in the rest. */
export interface RawTx {
  kind: string;
  direction: Direction;
  amount: number;
  counterparty: string;
  datetime: string | null;
  account: string | null;
  fee: number;
  vat: number;
  balance: number | null;
  txn: string | null;
  bankRef?: string | null;
  purpose?: string;
  foreign?: string | null;
}

export type TelebirrResult =
  | { cat: "tx"; tx: RawTx }
  | { cat: "bonus"; amount: number }
  | { cat: "loan_approved"; loan: Omit<LoanApproved, "smsTime"> }
  | { cat: "cancelled"; txn: string; amount: number; balance: number | null }
  | { cat: "verification" | "promo" | "airtime_received" | "failed" | "loan_reminder" | "unknown_money" | "other" };

export function parseTelebirr(m: string): TelebirrResult {
  const fee = m.match(FEE);
  const feeOnly = fee ? null : m.match(FEE_ONLY);
  const bal = m.match(BAL);
  const txn = m.match(TXN);
  const common = {
    fee: fee ? num(fee[1]) : feeOnly ? num(feeOnly[1]) : 0,
    vat: fee ? num(fee[2]) : 0,
    balance: bal ? num(bal[1]) : null,
    txn: txn ? txn[1] : null,
  };
  const T = (
    kind: string, direction: Direction, amount: string, counterparty: string, when: string | null,
    account: string | null = null, extra: Partial<RawTx> = {},
  ): TelebirrResult => {
    const tx: RawTx = { kind, direction, amount: num(amount), counterparty, datetime: when, account, ...common, ...extra };
    // like Python: common values only fill fields the pattern left empty
    for (const k of ["fee", "vat", "balance", "txn"] as const) if (extra[k] == null) (tx as any)[k] = (common as any)[k];
    if (extra.txn != null) tx.txn = extra.txn;
    return { cat: "tx", tx };
  };
  let r: RegExpMatchArray | null;

  // ---- not money in the wallet
  if (/verification code/.test(m)) return { cat: "verification" };
  if (/chance\(s\) to draw|lucky draw|spins on SuperApp|lottery|scratch chance|KYC upgrade/.test(m)) return { cat: "promo" };
  if ((r = m.match(R(`You have got ${AMT} bonus for receiving Remittance`))))
    return T("Remittance bonus", "in", r[1], "Remittance bonus", null);
  if ((r = m.match(R(`You have got ${AMT} bonus`)))) return { cat: "bonus", amount: num(r[1]) };
  if (R(`received ${AMT} airtime from`).test(m)) return { cat: "airtime_received" };
  if (/unsuccessful|not been successful|Failed to authenticate|processing failure|PIN or password is incorrect/.test(m))
    return { cat: "failed" };
  if (/outstanding .*credit balance|credit balance of|is due TODAY|overdue/.test(m) && !m.includes("repaid"))
    return { cat: "loan_reminder" };
  if ((r = m.match(R(String.raw`credit request with (?:the )?([A-Z0-9]+) contract number is successful\. The credit amount is ${AMT} and facilitation fee ${AMT} with due date (\d{2}/\d{2}/\d{4})`))))
    return { cat: "loan_approved", loan: { contract: r[1], amount: num(r[2]), facilitationFee: num(r[3]), due: r[4] } };
  if ((r = m.match(R(`request for transaction number ([A-Z0-9]{10}) with amount ${AMT} is cancelled`))))
    return { cat: "cancelled", txn: r[1], amount: num(r[2]), balance: common.balance };

  // ---- money out
  if ((r = m.match(R(String.raw`transferred ${AMT} successfully from your telebirr account \d+ to (.+?) account number (\d+) on ${DMY}`)))) {
    const bank = m.match(/bank transaction number is\s*([A-Z0-9]+)/);
    return T("Transfer to bank", "out", r[1], cleanName(r[2]), dt(r[4]), "****" + r[3].slice(-4), { bankRef: bank ? bank[1] : null });
  }
  if ((r = m.match(R(String.raw`transferred ${AMT} to (.+?)\s*${PHONE} on ${DMY}`))))
    return T("Transfer to person", "out", r[1], cleanName(r[2]), dt(r[4]), r[3]);
  if ((r = m.match(R(String.raw`paid ${AMT} for goods purchased (?:from|to) (\d+)\s*-\s*(.+?) on ${DMY}`))))
    return T("Merchant payment", "out", r[1], merchant(r[3]), dt(r[4]), "Merchant " + r[2]);
  if ((r = m.match(R(String.raw`paid ${AMT} for fuel purchased from (\d+)\s*-\s*(.+?) for plate number\s*(\S*?)\s*on ${DMY}`))))
    return T("Fuel", "out", r[1], cleanName(r[3]), dt(r[5]), r[4] ? "Plate " + r[4] : null);
  if ((r = m.match(R(String.raw`paid ${AMT} for package (.+?) purchase made for (\d+) on ${DMY}`))))
    return T("Package", "out", r[1], cleanName(r[2]), dt(r[4]), r[3]);
  if ((r = m.match(R(String.raw`recharged ${AMT} airtime for (\d+) on ${DMY}`))))
    return T("Airtime", "out", r[1], "Airtime " + r[2], dt(r[3]), r[2]);
  // "paid for Parking Payment ETB 280.00 to 519494 - X; with Payment reference ..."
  if ((r = m.match(R(String.raw`paid\s+for (.+?)\s+${AMT} to (\d+)\s*-\s*(.+?);.*? on ${DMY}`))))
    return T("Bill / service payment", "out", r[2], cleanName(r[4]), dt(r[5]), "Biller " + r[3], { purpose: cleanName(r[1]) });
  if ((r = m.match(R(String.raw`paid ${AMT} to (\d+)\s*-\s*(.+?) on ${DMY}`))))
    return T("Merchant payment", "out", r[1], merchant(r[3]), dt(r[4]), "Merchant " + r[2]);
  if ((r = m.match(R(String.raw`paid ${AMT} to (.+?) with Payment number (\S+) on ${DMY}`))))
    return T("Bill / service payment", "out", r[1], cleanName(r[2]), dt(r[4]), "Ref " + r[3]);
  // "paid ETB 7,510.00 to Ethiopian Airlines; Payment reference number ..."
  if ((r = m.match(R(String.raw`paid ${AMT} to (.+?);.*? on ${DMY}`))))
    return T("Bill / service payment", "out", r[1], cleanName(r[2]), dt(r[3]));
  if ((r = m.match(R(String.raw`paid ${AMT} for (.+?) to (\d+)\s*-\s*(.+?) on ${DMY}`))))
    return T("Bill / service payment", "out", r[1], cleanName(r[4]), dt(r[5]), "Biller " + r[3], { purpose: cleanName(r[2]) });
  if ((r = m.match(R(String.raw`paid ${AMT} for (\d+)\s*-\s*(.+?)(?: service)? on ${DMY}`))))
    return T("Bill / service payment", "out", r[1], cleanName(r[3]), dt(r[4]), "Biller " + r[2]);
  if ((r = m.match(R(String.raw`paid ${AMT} for (.+?) from (\d+)\s*-\s*(.+?) on ${DMY}`))))
    return T("Bill / service payment", "out", r[1], merchant(r[4]), dt(r[5]), "Biller " + r[3], { purpose: cleanName(r[2]) });
  if ((r = m.match(R(`paid ${AMT} for (Ethiopian Disaster Risk Management fund)`))))
    return T("Loan fees", "out", r[1], "Disaster Risk Mgmt fund (1% of loan)", null);
  if ((r = m.match(R(`paid ${AMT} for (.+?) on ${DMY}`))))
    return T("Bill / service payment", "out", r[1], cleanName(r[2]), dt(r[3]));
  if ((r = m.match(/repaid ([\d,]+\.\d{2}) ETB, for your (.+?) contract/)))
    return T("Loan repayment", "out", r[1], cleanName(r[2]) + " loan", null);
  if ((r = m.match(R(String.raw`outstanding Credit amount has been paid successfully\. The paid amount is ${AMT}.*?partnership with (.+?)$`))))
    return T("Loan repayment", "out", r[1], cleanName(r[2]) + " loan", null);

  // ---- money in
  if ((r = m.match(R(String.raw`received\s+${AMT} by transaction number ([A-Z0-9]{10}) on ${YMD} from (.+?) to your telebirr`))))
    return T("Received from bank", "in", r[1], cleanName(r[4]), dt(r[3]), null, { txn: r[2] });
  if ((r = m.match(R(String.raw`received\s+${AMT} from (.+?) with telebirr transaction number ([A-Z0-9]{10}) on ${YMD} via telebirr remittance`)))) {
    const fx = m.match(/Foreign Currency Amount:\s*([\d.,]+)\s*([A-Z]{3})/);
    return T("Remittance received", "in", r[1], cleanName(r[2]), dt(r[4]), null, { txn: r[3], foreign: fx ? `${fx[1]} ${fx[2]}` : null });
  }
  if ((r = m.match(R(String.raw`received\s+${AMT} from (.+?)\s*${PHONE}.*? on ${DMY}`))))
    return T("Received from person", "in", r[1], cleanName(r[2]), dt(r[4]), r[3]);
  if ((r = m.match(R(String.raw`credited with ${AMT} on ${DMY} via telebirr agent (\d+)`))))
    return T("Cash in (agent)", "in", r[1], "Agent " + r[3], dt(r[2]));
  if ((r = m.match(R(String.raw`account has been credited with ${AMT}\.`))))
    // no date / txn in the SMS: this is how loan money arrives
    return T("Credited (loan / other)", "in", r[1], "Telebirr credit", null);

  if (R(AMT).test(m)) return { cat: "unknown_money" };
  return { cat: "other" };
}

/** Official receipt link, when the SMS included one. */
export function telebirrReceipt(m: string): string | null {
  const link = m.match(/https?:\/\/\s*transactioninfo\.ethiotelecom\.et\/receipt\/\s*([A-Z0-9]{10})/);
  return link ? `https://transactioninfo.ethiotelecom.et/receipt/${link[1]}` : null;
}

export const telebirrMessageText = (m: string) => m.replace(/\s*To download your payment.*$/, "").trim();
