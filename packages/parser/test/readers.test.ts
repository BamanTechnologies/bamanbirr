// Reader tests with made-up messages (no personal data).
import { describe, expect, it } from "vitest";
import { analyze, analyzeTelebirr } from "../src";
import { readAndroidXml, readPdfPages } from "../src/readers";

const SEND = (amt: string, name: string, when: string, txn: string, bal: string) =>
  `Dear ABEBE You have transferred ETB ${amt} to ${name} (2519****1234) on ${when}. Your transaction number is ${txn}. ` +
  `The service fee is ETB 1.74 and 15% VAT on the service fee is ETB 0.26. Your current E-Money Account balance is ETB ${bal}. ` +
  `To download your payment information please click this link: https://transactioninfo.ethiotelecom.et/receipt/${txn}. Thank you for using telebirr Ethio telecom`;
const RECV = (amt: string, name: string, when: string, txn: string, bal: string) =>
  `Dear ABEBE You have received ETB ${amt} from ${name}(2519****5678) on ${when}. Your transaction number is ${txn}. ` +
  `Your current E- Money Account balance is ETB ${bal}. Thank you for using telebirr Ethio telecom`;

// Wrap at spaces, like a PDF's text layer does.
const wrap = (s: string, w = 60) => s.split(" ").reduce<string[]>((lines, word) => {
  const last = lines[lines.length - 1];
  if (last !== undefined && (last + " " + word).length <= w) lines[lines.length - 1] = last + " " + word;
  else lines.push(word);
  return lines;
}, []);

describe("PDF page text", () => {
  // Messages repeats the whole text layer on every page; headers carry the arrival time.
  const page = [
    "Text Message • SMS",
    "Sep 9, 2025 at 4:58 PM",
    "Dear Customer,",
    "123456 is your telebirr verification code, please don't",
    "share it with another person.",
    "Sep 10, 2025 at 1:44 PM",
    ...wrap(SEND("500.00", "Kebede Alemu", "10/09/2025 13:44:26", "CIA6QPCJO0", "870.52")),
    ...wrap(RECV("1,000.00", "Sara Tesfaye", "10/09/2025 15:00:00", "CIA7QPCJO1", "1,870.52")),
  ].join("\n");

  it("dedupes repeated pages and keeps header times", () => {
    const recs = readPdfPages([page, page, page], "telebirr");
    const report = analyzeTelebirr(recs);
    expect(report.counts).toEqual({ verification: 1, tx: 2 });
    expect(report.transactions.map((t) => [t.kind, t.counterparty, t.total, t.balanceOk])).toEqual([
      ["Transfer to person", "Kebede Alemu", -502, null],
      ["Received from person", "Sara Tesfaye", 1000, true],
    ]);
    expect(report.transactions[0].receipt).toBe("https://transactioninfo.ethiotelecom.et/receipt/CIA6QPCJO0");
    expect(recs.some((r) => r.smsTime === "2025-09-10 13:44:00")).toBe(true);
  });
});

describe("Android SMS Backup & Restore XML", () => {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const xml = `<?xml version='1.0' encoding='UTF-8' standalone='yes' ?>
<smses count="4">
  <sms protocol="0" address="127" date="1757501066000" type="1" body="${esc(SEND("500.00", "Kebede Alemu", "10/09/2025 13:44:26", "CIA6QPCJO0", "870.52"))}" read="1" />
  <sms protocol="0" address="CBE" date="1757501100000" type="1" body="${esc("Dear Abebe your Account 1*********4551 has been debited with ETB2,500.00 .Service charge of  ETB10 and VAT(15%) of ETB1.50 with a total of ETB2511. Your Current Balance is ETB 33,546.84. Thank you for Banking with CBE!")}" />
  <sms protocol="0" address="+251911000000" date="1757501200000" type="1" body="hi, call me" />
  <sms protocol="0" address="127" date="1757501300000" type="2" body="sent by me — ignored" />
</smses>`;

  it("keeps only received messages from the chosen senders", () => {
    const recs = readAndroidXml(xml, ["telebirr", "cbe"]);
    expect(recs.map((r) => r.source)).toEqual(["telebirr", "cbe"]);
    const res = analyze(recs);
    expect(res.telebirr?.transactions[0].counterparty).toBe("Kebede Alemu");
    const cbe = res.cbe!.transactions[0];
    expect([cbe.kind, cbe.amount, cbe.fee, cbe.vat, cbe.total]).toEqual(["Debit (no details)", 2500, 10, 1.5, -2511.5]);
  });

  it("can pick just one source", () => {
    expect(readAndroidXml(xml, ["cbe"]).length).toBe(1);
  });
});
