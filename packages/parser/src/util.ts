// Small helpers that mirror the Python reference implementation's behaviour.

export const PARSER_VERSION = "1.1.0";

/** Round to cents (half away from zero on the decimal value). */
export function round2(x: number): number {
  const r = Math.round(Math.abs(x) * 100 + 1e-7) / 100;
  return x < 0 ? -r : r;
}

/** "1,234.50" -> 1234.5 ; trailing dot tolerated ("7000.0." from CBE). */
export function num(s: string | undefined | null): number {
  if (!s) return 0;
  return parseFloat(s.replace(/,/g, "").replace(/\.+$/, ""));
}

function stripChars(s: string, chars: string): string {
  let a = 0;
  let b = s.length;
  while (a < b && chars.includes(s[a])) a++;
  while (b > a && chars.includes(s[b - 1])) b--;
  return s.slice(a, b);
}

const hasCased = (s: string) => s.toLowerCase() !== s.toUpperCase();
const isUpper = (s: string) => hasCased(s) && s === s.toUpperCase();
const isLower = (s: string) => hasCased(s) && s === s.toLowerCase();
const capitalize = (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();

/** Collapse spaces, trim punctuation, and Title-Case names written ALL CAPS or all lower. */
export function cleanName(s: string | undefined | null, strip = " -;.,"): string {
  let t = stripChars((s ?? "").replace(/\s+/g, " "), strip);
  if (isUpper(t) || isLower(t)) t = t.split(/\s+/).filter(Boolean).map(capitalize).join(" ");
  return t;
}

/** Drop trailing branch codes like "4kil0" from merchant names. */
export function merchant(s: string): string {
  return cleanName(s.trim().replace(/\s+\S*\d\S*$/, ""));
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "DD/MM/YYYY HH:MM:SS" or "YYYY-MM-DD HH:MM:SS" -> "YYYY-MM-DD HH:MM:SS" (validated), else null. */
export function dt(s: string | undefined | null): string | null {
  if (!s) return null;
  let m = s.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/);
  let y: number, mo: number, d: number, h: number, mi: number, se: number;
  if (m) [d, mo, y, h, mi, se] = [+m[1], +m[2], +m[3], +m[4], +m[5], +m[6]];
  else {
    m = s.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
    if (!m) return null;
    [y, mo, d, h, mi, se] = [+m[1], +m[2], +m[3], +m[4], +m[5], +m[6]];
  }
  if (mo < 1 || mo > 12 || h > 23 || mi > 59 || se > 59 || d < 1) return null;
  const dim = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  if (d > dim) return null;
  return `${y}-${pad(mo)}-${pad(d)} ${pad(h)}:${pad(mi)}:${pad(se)}`;
}

/** Seconds for a "YYYY-MM-DD HH:MM:SS" string; only differences are used, so the zone doesn't matter. */
export function ts(s: string): number {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return NaN;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) / 1000;
}

/** Format a JS Date as local "YYYY-MM-DD HH:MM:SS". */
export function localStamp(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Python-style tuple comparison for sort keys. */
export function cmpTuple(a: (string | number)[], b: (string | number)[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i];
    const y = b[i];
    if (x === y) continue;
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    return x < y ? -1 : 1;
  }
  return 0;
}
