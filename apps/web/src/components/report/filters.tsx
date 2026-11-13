"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, applyFilters, autoGroup, fmt0, type Filters, type Group, type Preset, type Tx } from "@/lib/report/model";

function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl border border-line bg-surface p-0.5">
      {options.map(([v, l]) => (
        <button key={v} role="radio" aria-checked={value === v} onClick={() => onChange(v)}
          className={`rounded-[10px] px-2.5 py-1.5 text-[13px] transition ${value === v ? "bg-brand-50 font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-200" : "text-ink-2 hover:text-ink"}`}>
          {l}
        </button>
      ))}
    </div>
  );
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1">
    <span className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</span>
    {children}
  </div>
);
const inputCls = "rounded-xl border border-line bg-surface px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-200 dark:focus:ring-brand-800";

/** Person picker: lists only people in the current filters, searchable, scrollable. */
function PersonPicker({ all, f, onPick }: { all: Tx[]; f: Filters; onPick: (p: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [act, setAct] = useState(-1);
  const listRef = useRef<HTMLDivElement>(null);
  const everyone = useMemo(() => {
    const m = new Map<string, { name: string; n: number; v: number }>();
    for (const t of applyFilters(all, f, true)) { const o = m.get(t.counterparty) ?? { name: t.counterparty, n: 0, v: 0 }; o.n++; o.v += Math.abs(t.total); m.set(t.counterparty, o); }
    return [...m.values()].sort((a, b) => b.n - a.n || b.v - a.v);
  }, [all, f]);
  const typed = q.trim().toLowerCase();
  const opts = typed ? everyone.filter((p) => p.name.toLowerCase().includes(typed)) : everyone;
  const pick = (p: string) => { onPick(p); setOpen(false); setQ(""); setAct(-1); };
  // Keep the keyboard-highlighted option visible (option 0 is "All people").
  useEffect(() => {
    if (open && act >= 0) listRef.current?.querySelectorAll("[role=option]")[act + 1]?.scrollIntoView({ block: "nearest" });
  }, [open, act]);
  const mark = (name: string) => {
    if (!typed) return name;
    const i = name.toLowerCase().indexOf(typed);
    return i < 0 ? name : <>{name.slice(0, i)}<mark className="bg-transparent font-semibold text-brand-600">{name.slice(i, i + typed.length)}</mark>{name.slice(i + typed.length)}</>;
  };
  return (
    <div className="relative">
      <input
        className={`${inputCls} w-56 pr-7`} role="combobox" aria-label="Person or merchant" aria-expanded={open} aria-controls="person-list" autoComplete="off" spellCheck={false}
        placeholder="All people — type to search" value={open ? q : f.person}
        onFocus={() => { setOpen(true); setQ(""); }}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onChange={(e) => { setQ(e.target.value); setAct(0); setOpen(true); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { setOpen(true); setAct((a) => Math.min(opts.length - 1, a + 1)); e.preventDefault(); }
          else if (e.key === "ArrowUp") { setAct((a) => Math.max(-1, a - 1)); e.preventDefault(); }
          else if (e.key === "Enter") { if (act >= 0 && opts[act]) pick(opts[act].name); else if (!q.trim()) pick(""); e.preventDefault(); }
          else if (e.key === "Escape") { setOpen(false); (e.target as HTMLInputElement).blur(); }
        }}
      />
      {f.person && !open && (
        <button aria-label="Show everyone" onClick={() => pick("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink">✕</button>
      )}
      {open && (
        <div id="person-list" ref={listRef} role="listbox"
          className="absolute right-0 top-[calc(100%+6px)] z-40 max-h-80 w-80 max-w-[calc(100vw-2rem)] overflow-y-auto xl:left-0 xl:right-auto overscroll-contain rounded-2xl border border-line bg-surface p-1 shadow-2xl shadow-brand-900/15">
          <Opt sel={!f.person} onPick={() => pick("")} name="All people" meta={`${everyone.length} in this period`} />
          <p className="px-2.5 pb-1 pt-2 text-[11px] uppercase tracking-wide text-muted">{typed ? `${opts.length} match${opts.length === 1 ? "" : "es"}` : "Most transactions first"}</p>
          {opts.length ? opts.map((p, i) => (
            <Opt key={p.name} act={i === act} sel={p.name === f.person} onPick={() => pick(p.name)} name={mark(p.name)} meta={`${p.n} · ${fmt0(p.v)}`} />
          )) : <p className="px-2.5 py-3 text-[13px] text-muted">No one matches in the selected period and filters.</p>}
        </div>
      )}
    </div>
  );
}
function Opt({ name, meta, sel, act, onPick }: { name: React.ReactNode; meta: string; sel?: boolean; act?: boolean; onPick: () => void }) {
  return (
    <div role="option" aria-selected={sel} onMouseDown={(e) => { e.preventDefault(); onPick(); }}
      className={`flex cursor-pointer items-baseline justify-between gap-3 rounded-xl px-2.5 py-1.5 text-[13px] hover:bg-wash ${act ? "bg-wash" : ""} ${sel ? "font-semibold" : ""}`}>
      <span className="truncate">{name}</span><span className="tabular shrink-0 text-[11px] text-muted">{meta}</span>
    </div>
  );
}

export function FilterBar({ all, f, set, minDay, maxDay }: { all: Tx[]; f: Filters; set: (p: Partial<Filters>) => void; minDay: string; maxDay: string }) {
  const types = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of all) m.set(t.kind, (m.get(t.kind) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [all]);
  const preset = (p: Preset) => {
    if (p === "custom") return set({ preset: p });
    const from = p === "all" ? minDay : (() => { const d = addDays(maxDay, -(+p - 1)); return d < minDay ? minDay : d; })();
    set({ preset: p, from, to: maxDay, group: autoGroup(from, maxDay) });
  };
  const allTypes = f.types.size === types.length;
  return (
    <div className="z-20 -mx-4 border-b border-line bg-page/90 px-4 pb-3 pt-3 backdrop-blur-md sm:-mx-6 sm:px-6 xl:sticky xl:top-16">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <Field label="Period">
          <Seg label="Period" value={f.preset} onChange={preset}
            options={[["all", "All"], ["7", "7d"], ["30", "30d"], ["90", "90d"], ["365", "12m"], ["custom", "Custom"]]} />
        </Field>
        <Field label="From">
          <input type="date" className={inputCls} min={minDay} max={maxDay} value={f.from}
            onChange={(e) => { const from = e.target.value || minDay; set({ from, preset: "custom", group: autoGroup(from, f.to) }); }} />
        </Field>
        <Field label="To">
          <input type="date" className={inputCls} min={minDay} max={maxDay} value={f.to}
            onChange={(e) => { const to = e.target.value || maxDay; set({ to, preset: "custom", group: autoGroup(f.from, to) }); }} />
        </Field>
        <Field label="Group by">
          <Seg label="Group by" value={f.group} onChange={(group: Group) => set({ group })} options={[["day", "Day"], ["week", "Week"], ["month", "Month"]]} />
        </Field>
        <Field label="Direction">
          <Seg label="Direction" value={f.dir} onChange={(dir) => set({ dir })} options={[["all", "All"], ["in", "In"], ["out", "Out"]]} />
        </Field>
        <Field label="Person / merchant"><PersonPicker all={all} f={f} onPick={(person) => set({ person })} /></Field>
        <Field label="Time of day">
          <select aria-label="Time of day" className={inputCls} value={f.tod} onChange={(e) => set({ tod: e.target.value as Filters["tod"] })}>
            <option value="all">Any time</option><option value="morning">Morning 06–12</option><option value="afternoon">Afternoon 12–18</option>
            <option value="evening">Evening 18–24</option><option value="night">Night 00–06</option>
          </select>
        </Field>
        <Field label="Weekday">
          <select aria-label="Weekday" className={inputCls} value={f.wd} onChange={(e) => set({ wd: e.target.value })}>
            <option value="all">Any day</option><option value="weekday">Mon–Fri</option><option value="weekend">Sat–Sun</option>
            {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((d, i) => <option key={d} value={String((i + 1) % 7)}>{d}</option>)}
          </select>
        </Field>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {types.map(([k, n]) => {
          const on = f.types.has(k);
          return (
            <button key={k}
              onClick={() => {
                const next = new Set(f.types);
                if (allTypes) set({ types: new Set([k]) });
                else { if (on) next.delete(k); else next.add(k); set({ types: next.size ? next : new Set(types.map(([t]) => t)) }); }
              }}
              className={`rounded-full border px-2.5 py-1 text-[12px] transition ${on && !allTypes ? "border-brand-400 bg-brand-50 font-medium text-brand-700 dark:bg-brand-950 dark:text-brand-200" : on ? "border-line bg-surface text-ink-2" : "border-line bg-transparent text-muted line-through"}`}>
              {k} <span className="tabular text-muted">{n}</span>
            </button>
          );
        })}
        {!allTypes && (
          <button onClick={() => set({ types: new Set(types.map(([t]) => t)) })} className="rounded-full border border-dashed border-line-strong px-2.5 py-1 text-[12px] text-ink-2">All types</button>
        )}
      </div>
    </div>
  );
}
