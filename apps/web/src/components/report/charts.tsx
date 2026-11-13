"use client";
import { useCallback, useMemo, useRef, useState, type PointerEvent } from "react";
import { useTipHandlers } from "./tooltip";
import {
  DOW, MON, addDays, bucketKey, bucketLabel, bucketsInRange, daysBetween, fmt, fmt0, niceDay, sgn,
  type Filters, type Grouped, type Tx,
} from "@/lib/report/model";

function nice(m: number) {
  if (m <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(m)));
  for (const s of [1, 2, 2.5, 5, 10]) if (s * p >= m) return s * p;
  return 10 * p;
}
const compact = (v: number) => (Math.abs(v) >= 1e6 ? `${+(v / 1e6).toFixed(1)}M` : Math.abs(v) >= 1e3 ? `${+(v / 1e3).toFixed(0)}k` : fmt0(v));

/**
 * Width of the chart's box in CSS pixels. Charts draw with a viewBox of exactly
 * this width, so text keeps its real size (11–12px) on phones instead of being
 * scaled down from a fixed desktop-sized drawing.
 */
function useWidth(fallback = 1000) {
  const [w, setW] = useState(fallback);
  const obs = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: HTMLDivElement | null) => {
    obs.current?.disconnect();
    obs.current = null;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => { const cw = Math.round(e.contentRect.width); if (cw > 0) setW(cw); }); // 0 while in a hidden tab
    ro.observe(el);
    obs.current = ro;
  }, []);
  return [ref, w] as const;
}

/** x of a pointer event on an element inside a chart's <svg>, in viewBox units. */
const svgX = (e: PointerEvent, W: number) => {
  const r = (e.currentTarget as SVGGraphicsElement).ownerSVGElement?.getBoundingClientRect();
  return r && r.width ? ((e.clientX - r.left) * W) / r.width : 0;
};

/** Rounded data-end bar anchored on the baseline. */
function bar(x: number, y0: number, w: number, h: number, up: boolean, r = 4) {
  r = Math.min(r, Math.abs(h), w / 2);
  if (h <= 0.5) return "";
  if (up) { const y = y0 - h; return `M${x},${y0}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y0}Z`; }
  const y = y0 + h; return `M${x},${y0}V${y - r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y - r}V${y0}Z`;
}
function hbar(x0: number, y: number, w: number, h: number, r = 4) {
  r = Math.min(r, w, h / 2);
  if (w <= 0.5) return "";
  return `M${x0},${y}H${x0 + w - r}Q${x0 + w},${y} ${x0 + w},${y + r}V${y + h - r}Q${x0 + w},${y + h} ${x0 + w - r},${y + h}H${x0}Z`;
}

const Empty = ({ text = "No transactions match these filters." }) => <div className="py-10 text-center text-sm text-muted">{text}</div>;

/* ---------------------------------------------------------- in vs out */
export function FlowChart({ rows, f }: { rows: Tx[]; f: Filters }) {
  const tip = useTipHandlers();
  const [box, W] = useWidth();
  const [active, setActive] = useState<string | null>(null);
  const B = useMemo(() => {
    const keys = bucketsInRange(f);
    const idx = new Map(keys.map((k, i) => [k, i]));
    const b = keys.map((k) => ({ k, i: 0, o: 0, n: 0 }));
    for (const t of rows) {
      const x = b[idx.get(bucketKey(t.day, f.group)) ?? -1];
      if (!x) continue;
      x.n++;
      if (t.total > 0) x.i += t.total; else x.o -= t.total;
    }
    return b;
  }, [rows, f]);
  if (!rows.length) return <div ref={box}><Empty /></div>;
  const narrow = W < 520;
  const H = narrow ? 220 : 300, L = narrow ? 40 : 56, R = 8, T = 10, Bt = 28;
  const mx = nice(Math.max(1, ...B.map((b) => Math.max(b.i, b.o))));
  const half = (H - T - Bt) / 2, y = (v: number) => T + half - (v / mx) * half, y0 = y(0);
  const bw = (W - L - R) / B.length;
  const every = Math.ceil(B.length / Math.max(2, Math.floor((W - L - R) / 58))); // labels ≥ ~58px apart
  const at = (e: PointerEvent) => B[Math.min(B.length - 1, Math.max(0, Math.floor((svgX(e, W) - L) / bw)))];
  return (
    <div ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label="Money in and out per period">
        {[-mx, -mx / 2, 0, mx / 2, mx].map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={v === 0 ? "var(--line-strong)" : "var(--line)"} />
            <text x={L - 6} y={y(v) + 4} textAnchor="end" className="fill-muted text-[11px] tabular">{(v < 0 ? "−" : "") + compact(Math.abs(v))}</text>
          </g>
        ))}
        {B.map((b, k) => {
          const x = L + k * bw, w = Math.max(2, Math.min(26, bw * 0.38)), g = bw > 6 ? 2 : 0;
          return (
            <g key={b.k}>
              {active === b.k && <rect x={x} y={T} width={bw} height={H - T - Bt} fill="var(--wash)" />}
              <path d={bar(x + bw / 2 - w - g / 2, y0 - 1, w, y0 - 1 - y(b.i), true)} fill="var(--in)" />
              <path d={bar(x + bw / 2 + g / 2, y0 + 1, w, y(-b.o) - y0 - 1, false)} fill="var(--out)" />
              {k % every === 0 && <text x={x + bw / 2} y={H - 8} textAnchor="middle" className="fill-muted text-[11px]">{bucketLabel(b.k, f.group, true)}</text>}
            </g>
          );
        })}
        {/* One hit area for the whole plot: works for 3px-wide buckets and for taps. */}
        <rect x={L} y={T} width={W - L - R} height={H - T - Bt} fill="transparent"
          {...tip((e) => {
            const b = at(e);
            setActive(b.k);
            return <div className="space-y-0.5"><b>{bucketLabel(b.k, f.group)}</b><div>In: {fmt(b.i)}</div><div>Out: {fmt(b.o)}</div><div>Net: {sgn(b.i - b.o)}</div><div className="text-muted">{b.n} transaction{b.n === 1 ? "" : "s"}</div></div>;
          }, () => setActive(null))} />
      </svg>
    </div>
  );
}

/* ---------------------------------------------------------- balance */
export function BalanceChart({ all, f }: { all: Tx[]; f: Filters }) {
  const tip = useTipHandlers();
  const [box, W] = useWidth();
  const [hover, setHover] = useState<Tx | null>(null);
  const P = useMemo(() => all.filter((t) => t.day >= f.from && t.day <= f.to && t.bal != null), [all, f.from, f.to]);
  if (!P.length) return <div ref={box}><Empty text="No balance information in this period." /></div>;
  const narrow = W < 520;
  const H = narrow ? 190 : 240, L = narrow ? 44 : 60, R = 12, T = 12, Bt = 26;
  const t0 = new Date(f.from + "T00:00").getTime(), t1 = new Date(addDays(f.to, 1) + "T00:00").getTime();
  const hi = Math.max(...P.map((p) => p.bal!)), st = nice(hi / 4), ymax = Math.ceil(hi / st) * st || st;
  const X = (d: Date) => L + ((d.getTime() - t0) / (t1 - t0)) * (W - L - R);
  const Y = (v: number) => T + ((ymax - Math.max(0, v)) / ymax) * (H - T - Bt);
  let dp = `M${X(P[0].d)},${Y(P[0].bal! - P[0].total)}`;
  for (const p of P) dp += `H${X(p.d)}V${Y(p.bal!)}`;
  const nd = daysBetween(f.from, f.to) + 1;
  let ticks: { x: number; label: string }[] = [];
  if (nd > 75) {
    const d = new Date(f.from + "T00:00"); d.setDate(1); d.setMonth(d.getMonth() + 1);
    while (d.getTime() < t1) { ticks.push({ x: X(d), label: `${MON[d.getMonth()]} ${String(d.getFullYear()).slice(2)}` }); d.setMonth(d.getMonth() + 1); }
  } else {
    for (let i = 0; i < nd; i++) { const s = addDays(f.from, i); ticks.push({ x: X(new Date(s + "T12:00")), label: niceDay(s) }); }
  }
  const room = Math.max(2, Math.floor((W - L - R) / 64)); // labels ≥ ~64px apart
  const step = Math.ceil(ticks.length / room);
  ticks = ticks.filter((_, i) => i % step === 0);
  const grid: number[] = [];
  for (let v = 0; v <= ymax + 1e-6; v += st) grid.push(v);
  const nearest = (e: PointerEvent) => {
    const mx = svgX(e, W);
    let best = P[0];
    for (const p of P) if (X(p.d) <= mx) best = p;
    return best;
  };
  return (
    <div ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label="Account balance over time">
        {grid.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke={v === 0 ? "var(--line-strong)" : "var(--line)"} />
            <text x={L - 6} y={Y(v) + 4} textAnchor="end" className="fill-muted text-[11px] tabular">{compact(v)}</text>
          </g>
        ))}
        {ticks.map((t, i) => <text key={i} x={t.x} y={H - 8} textAnchor="middle" className="fill-muted text-[11px]">{t.label}</text>)}
        <path d={dp + `V${Y(0)}H${X(P[0].d)}Z`} fill="var(--in)" opacity="0.07" />
        <path d={dp} fill="none" stroke="var(--in)" strokeWidth="2" strokeLinejoin="round" />
        {hover && (
          <>
            <line x1={X(hover.d)} x2={X(hover.d)} y1={T} y2={H - Bt} stroke="var(--line-strong)" />
            <circle cx={X(hover.d)} cy={Y(hover.bal!)} r="4.5" fill="var(--in)" stroke="var(--surface)" strokeWidth="2" />
          </>
        )}
        <rect x={L} y={T} width={W - L - R} height={H - T - Bt} fill="transparent"
          {...tip((e) => {
            const best = nearest(e);
            setHover(best);
            return <div className="space-y-0.5"><b>{best.datetime.slice(0, 16)}</b><div>{best.counterparty}: {sgn(best.total)}</div><div>Balance: {fmt(best.bal!)}</div></div>;
          }, () => setHover(null))} />
      </svg>
    </div>
  );
}

/* ---------------------------------------------------------- ranked bars */
export function HBars({ items, color, onPick, extra }: { items: Grouped[]; color: string; onPick?: (name: string) => void; extra: (g: Grouped) => string }) {
  const tip = useTipHandlers();
  const [box, W] = useWidth(520);
  if (!items.length) return <div ref={box}><Empty text="Nothing here for these filters." /></div>;
  const rh = 30, L = Math.min(190, Math.max(96, Math.round(W * 0.38))), R = 64, H = items.length * rh + 4, mx = Math.max(...items.map((i) => i.v));
  const maxChars = Math.max(8, Math.floor((L - 10) / 6.6));
  return (
    <div ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role={onPick ? "group" : "img"}>
        {items.map((it, k) => {
          const y = k * rh + 4, w = Math.max(2, (it.v / mx) * (W - L - R));
          const pickable = onPick
            ? {
                tabIndex: 0, role: "button", "aria-label": `${it.name}: ${fmt(it.v)} ETB. Focus on them`,
                onClick: () => onPick(it.name),
                onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(it.name); } },
              }
            : {};
          return (
            <g key={it.name} className={onPick ? "group cursor-pointer outline-none" : ""} {...pickable}>
              {onPick && <rect x={1} y={y + 1} width={W - 2} height={rh - 2} rx={8} fill="none" stroke="var(--color-brand-500)" strokeWidth={2} className="opacity-0 group-focus-visible:opacity-100" />}
              <text x={L - 10} y={y + rh / 2} textAnchor="end" dominantBaseline="middle" className="fill-ink-2 text-[12px] group-hover:fill-ink group-hover:underline group-focus-visible:fill-ink">
                {it.name.length > maxChars ? it.name.slice(0, maxChars - 1) + "…" : it.name}
              </text>
              <path d={hbar(L, y + 7, w, rh - 14)} fill={color} />
              <text x={L + w + 6} y={y + rh / 2} dominantBaseline="middle" className="fill-ink text-[12px] tabular">{fmt0(it.v)}</text>
              <rect x={0} y={y} width={W} height={rh} fill="transparent"
                {...tip(() => <div className="space-y-0.5"><b>{it.name}</b><div>{fmt(it.v)} ETB</div><div className="text-muted">{extra(it)}</div></div>)} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ---------------------------------------------------------- heatmap */
export function Heatmap({ rows }: { rows: Tx[] }) {
  const tip = useTipHandlers();
  const [box, W] = useWidth();
  const grid = useMemo(() => {
    const g = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({ n: 0, i: 0, o: 0 })));
    for (const t of rows) { const c = g[t.wday][t.hour]; c.n++; if (t.total > 0) c.i += t.total; else c.o -= t.total; }
    return g;
  }, [rows]);
  const mx = Math.max(1, ...grid.flat().map((c) => c.n));
  const steps = ["var(--q1)", "var(--q2)", "var(--q3)", "var(--q4)", "var(--q5)", "var(--q6)"];
  const narrow = W < 520;
  const L = narrow ? 34 : 40, T = 4, cw = (W - L) / 24, ch = narrow ? 22 : 26, H = T + 7 * ch + 20;
  const hourStep = cw < 22 ? 6 : 3;
  const gap = cw > 10 ? 1 : 0.5;
  return (
    <div ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label="Transactions by weekday and hour">
        {[1, 2, 3, 4, 5, 6, 0].map((wd, r) => (
          <g key={wd}>
            <text x={L - 6} y={T + r * ch + ch / 2 + 4} textAnchor="end" className="fill-muted text-[11px]">{DOW[wd]}</text>
            {grid[wd].map((c, h) => (
              <rect key={h} x={L + h * cw + gap} y={T + r * ch + 1} width={Math.max(1, cw - 2 * gap)} height={ch - 2} rx={Math.min(4, cw / 4)}
                fill={c.n ? steps[Math.min(5, Math.floor((c.n / mx) * 5.999))] : "var(--wash)"}
                {...tip(() => <div className="space-y-0.5"><b>{DOW[wd]} {String(h).padStart(2, "0")}:00–{String(h + 1).padStart(2, "0")}:00</b><div>{c.n} transaction{c.n === 1 ? "" : "s"}</div>{c.n > 0 && <><div>In: {fmt(c.i)}</div><div>Out: {fmt(c.o)}</div></>}</div>)} />
            ))}
          </g>
        ))}
        {Array.from({ length: 24 / hourStep }, (_, i) => i * hourStep).map((h) => (
          <text key={h} x={L + h * cw + cw / 2} y={H - 4} textAnchor="middle" className="fill-muted text-[11px]">{String(h).padStart(2, "0")}</text>
        ))}
      </svg>
      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted">
        fewer {steps.map((s) => <span key={s} className="inline-block h-2.5 w-5 rounded-sm" style={{ background: s }} />)} more
      </div>
    </div>
  );
}
