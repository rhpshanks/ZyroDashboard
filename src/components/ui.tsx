import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { Game } from '../types';

// ---- Icons -------------------------------------------------------------------

const ICONS = {
  gear: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M12 2v2 M12 20v2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M2 12h2 M20 12h2 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z',
  close: 'M18 6 6 18 M6 6l12 12',
  up: 'M12 19V5 M5 12l7-7 7 7',
  down: 'M12 5v14 M19 12l-7 7-7-7',
  left: 'M15 18l-6-6 6-6',
  right: 'M9 18l6-6-6-6',
  grip: 'M9 5h.01 M15 5h.01 M9 12h.01 M15 12h.01 M9 19h.01 M15 19h.01',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  eyeOff: 'M3 3l18 18 M10.6 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2 M6.6 6.6A17.4 17.4 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6 M9.9 9.9a3 3 0 0 0 4.2 4.2',
  calendar: 'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z M16 2v4 M8 2v4 M4 10h16',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z M21 21l-4.3-4.3',
  download: 'M12 3v12 M7 10l5 5 5-5 M5 21h14',
  copy: 'M9 9h10v12H9Z M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1',
  external: 'M14 4h6v6 M20 4l-9 9 M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  table: 'M3 5h18v14H3Z M3 10h18 M3 15h18 M9 5v14',
  chart: 'M4 20V10 M10 20V4 M16 20v-7 M22 20H2',
  reset: 'M3 12a9 9 0 1 0 3-6.7L3 8 M3 3v5h5',
  check: 'M5 12l5 5 9-11',
  alert: 'M12 9v4 M12 17h.01 M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z M12 16v-4 M12 8h.01',
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={name === 'grip' ? 3 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={ICONS[name]} />
    </svg>
  );
}

// ---- Segmented control -----------------------------------------------------------

export interface SegOption<T extends string | number> {
  value: T;
  label: ReactNode;
  title?: string;
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
  size = 'md',
}: {
  value: T;
  options: SegOption<T>[];
  onChange: (v: T) => void;
  label: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div className={`seg seg-${size}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          title={o.title}
          className={o.value === value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" className={`toggle ${on ? 'on' : ''}`} role="switch" aria-checked={on} onClick={() => onChange(!on)}>
      <span className="toggle-track" aria-hidden="true">
        <span className="toggle-thumb" />
      </span>
      <span>{label}</span>
    </button>
  );
}

// ---- Panel ------------------------------------------------------------------------

export function Panel({
  id,
  title,
  sub,
  tools,
  wide,
  children,
  className = '',
}: {
  id: string;
  title: string;
  sub?: ReactNode;
  tools?: ReactNode;
  wide?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${wide ? 'wide' : ''} ${className}`} aria-labelledby={`${id}-title`} data-panel={id}>
      <header className="panel-head">
        <div className="panel-titles">
          <h2 id={`${id}-title`}>{title}</h2>
          {sub ? <p>{sub}</p> : null}
        </div>
        {tools ? <div className="panel-tools">{tools}</div> : null}
      </header>
      {children}
    </section>
  );
}

// ---- Game avatar --------------------------------------------------------------------

export function GameAvatar({ game, size = 24 }: { game?: Game; size?: number }) {
  const [failed, setFailed] = useState(false);
  const initials = game ? game.short.split(/\s+/).map((w) => w[0]).join('').slice(0, 2) : '∑';
  if (!game?.icon || failed) {
    return (
      <span className="avatar avatar-fallback" style={{ width: size, height: size, fontSize: size * 0.4 }} aria-hidden="true">
        {initials}
      </span>
    );
  }
  return (
    <img
      className="avatar"
      src={game.icon}
      width={size}
      height={size}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

// ---- Measuring -------------------------------------------------------------------------

export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

export function useMediaQuery(q: string) {
  const [match, setMatch] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(q).matches : false));
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setMatch(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [q]);
  return match;
}

// ---- Tooltip -------------------------------------------------------------------------------

export interface TipRow {
  key: string;
  label: string;
  value: string;
  /** CSS colour for the key mark; omitted = no key */
  color?: string;
  mark?: 'line' | 'rect' | 'dot';
  muted?: boolean;
}

export function ChartTooltip({
  x,
  y,
  width,
  title,
  rows,
  hint,
}: {
  x: number;
  y: number;
  width: number;
  title: string;
  rows: TipRow[];
  hint?: string;
}) {
  const flip = x > width * 0.58;
  const style = flip ? { right: Math.max(4, width - x + 14), top: y } : { left: Math.min(x + 14, width - 120), top: y };
  return (
    <div className="tip" style={style} role="status" aria-live="polite">
      <div className="tip-title">{title}</div>
      {rows.map((r) => (
        <div key={r.key} className={`tip-row ${r.muted ? 'muted' : ''}`}>
          <span className={`tip-key tip-key-${r.mark ?? 'line'}`} style={r.color ? { background: r.color } : { visibility: 'hidden' }} />
          <span className="tip-value">{r.value}</span>
          <span className="tip-label">{r.label}</span>
        </div>
      ))}
      {hint ? <div className="tip-hint">{hint}</div> : null}
    </div>
  );
}

/** Arrow-key navigation over an indexed series, shared by the charts. */
export function useKeyNav(count: number, onEnter?: (i: number) => void) {
  const [active, setActive] = useState<number | null>(null);
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!count) return;
    let next = active ?? count - 1;
    if (e.key === 'ArrowRight') next = Math.min(count - 1, next + 1);
    else if (e.key === 'ArrowLeft') next = Math.max(0, next - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = count - 1;
    else if (e.key === 'Enter' && active !== null) {
      onEnter?.(active);
      return;
    } else if (e.key === 'Escape') {
      setActive(null);
      return;
    } else return;
    e.preventDefault();
    setActive(next);
  };
  return { active, setActive, onKeyDown };
}

/** Bar path with a rounded data end and a square baseline end. */
export function barPath(x: number, w: number, yBase: number, yVal: number, r = 4): string {
  const h = Math.abs(yBase - yVal);
  if (h < 0.5 || w <= 0) return '';
  const rr = Math.min(r, w / 2, h);
  if (yVal <= yBase) {
    // grows upward
    return `M${x},${yBase}V${yVal + rr}Q${x},${yVal} ${x + rr},${yVal}H${x + w - rr}Q${x + w},${yVal} ${x + w},${yVal + rr}V${yBase}Z`;
  }
  return `M${x},${yBase}V${yVal - rr}Q${x},${yVal} ${x + rr},${yVal}H${x + w - rr}Q${x + w},${yVal} ${x + w},${yVal - rr}V${yBase}Z`;
}

/** Choose tick indices so labels never crowd, always keeping the latest point. */
export function tickIndices(n: number, plotWidth: number, minGap = 64): number[] {
  if (n <= 0) return [];
  const max = Math.max(1, Math.floor(plotWidth / minGap));
  const step = Math.max(1, Math.ceil(n / max));
  const out: number[] = [];
  for (let i = n - 1; i >= 0; i -= step) out.unshift(i);
  return out;
}
