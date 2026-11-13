"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";

type Point = { clientX: number; clientY: number };
type Show = (e: Point, content: ReactNode) => void;
const Ctx = createContext<{ show: Show; hide: () => void }>({ show: () => {}, hide: () => {} });

/**
 * One floating tooltip shared by every chart. Mouse: follows the pointer.
 * Touch / pen: a tap shows it; tapping elsewhere or scrolling hides it.
 */
export function TooltipProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ x: number; y: number; content: ReactNode } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const show = useCallback<Show>((e, content) => {
    const w = ref.current?.offsetWidth ?? 180, h = ref.current?.offsetHeight ?? 60;
    let x = e.clientX + 14, y = e.clientY + 14;
    if (x + w > window.innerWidth - 8) x = Math.max(8, e.clientX - w - 14);
    if (y + h > window.innerHeight - 8) y = Math.max(8, e.clientY - h - 14);
    setState({ x, y, content });
  }, []);
  const hide = useCallback(() => setState(null), []);
  useEffect(() => {
    if (!state) return;
    // Capture phase: runs before a chart's own pointerdown, which then shows the new tooltip.
    const tap = () => setState(null);
    document.addEventListener("pointerdown", tap, true);
    window.addEventListener("scroll", tap, { passive: true });
    return () => { document.removeEventListener("pointerdown", tap, true); window.removeEventListener("scroll", tap); };
  }, [state]);
  return (
    <Ctx.Provider value={{ show, hide }}>
      {children}
      <div
        ref={ref}
        role="tooltip"
        className="pointer-events-none fixed z-50 max-w-[calc(100vw-16px)] rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink shadow-xl shadow-brand-900/10"
        style={{ left: state?.x ?? -9999, top: state?.y ?? -9999, opacity: state ? 1 : 0 }}
      >
        {state?.content}
      </div>
    </Ctx.Provider>
  );
}

export const useTooltip = () => useContext(Ctx);

/**
 * Pointer handlers for an element with a tooltip. `content` gets the event, so
 * one element can show different content by position (e.g. a chart overlay).
 */
export function useTipHandlers() {
  const { show, hide } = useTooltip();
  return useCallback(
    (content: (e: PointerEvent) => ReactNode, onLeave?: () => void) => ({
      onPointerMove: (e: PointerEvent) => { if (e.pointerType === "mouse") show(e, content(e)); },
      onPointerDown: (e: PointerEvent) => show(e, content(e)),
      onPointerLeave: (e: PointerEvent) => { if (e.pointerType === "mouse") { hide(); onLeave?.(); } },
    }),
    [show, hide],
  );
}
