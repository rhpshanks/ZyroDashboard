import type { Bucket, DayRow, Entry, Gran } from '../types';
import {
  addDays,
  diffDays,
  eachDay,
  endOfMonth,
  fmtDate,
  fmtRange,
  maxISO,
  minISO,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from './date';

export const roasOf = (revenue: number, spend: number): number | null => (spend > 0 ? revenue / spend : null);

/** Group entries by date, keeping only the selected games (empty selection = all). */
export function indexEntries(entries: Entry[], games: string[]): Map<string, Entry[]> {
  const pick = games.length ? new Set(games) : null;
  const map = new Map<string, Entry[]>();
  for (const e of entries) {
    if (pick && !pick.has(e.game ?? '__untagged')) continue;
    const list = map.get(e.date);
    if (list) list.push(e);
    else map.set(e.date, [e]);
  }
  return map;
}

export function buildDays(byDate: Map<string, Entry[]>, start: string, end: string): DayRow[] {
  if (start > end) return [];
  return eachDay(start, end).map((date) => {
    const list = byDate.get(date) ?? [];
    let spend = 0;
    let revenue = 0;
    let installs = 0;
    let hasInstalls = false;
    for (const e of list) {
      spend += e.spend;
      revenue += e.revenue;
      if (e.installs !== undefined) {
        installs += e.installs;
        hasInstalls = true;
      }
    }
    return { date, has: list.length > 0, spend, revenue, net: revenue - spend, installs, hasInstalls, entries: list };
  });
}

export interface Summary {
  spend: number;
  revenue: number;
  net: number;
  roas: number | null;
  margin: number | null;
  tracked: number;
  span: number;
  profitable: number;
  loss: number;
  avgSpend: number;
  avgRevenue: number;
  avgNet: number;
  best?: DayRow;
  worst?: DayRow;
  installs: number;
  hasInstalls: boolean;
  cpi: number | null;
  /** Consecutive profitable tracked days ending at the last tracked day. */
  streak: number;
}

export function summarize(days: DayRow[]): Summary {
  let spend = 0;
  let revenue = 0;
  let tracked = 0;
  let profitable = 0;
  let loss = 0;
  let installs = 0;
  let installSpend = 0;
  let hasInstalls = false;
  let best: DayRow | undefined;
  let worst: DayRow | undefined;
  for (const d of days) {
    if (!d.has) continue;
    tracked++;
    spend += d.spend;
    revenue += d.revenue;
    if (d.net > 0) profitable++;
    else if (d.net < 0) loss++;
    if (d.hasInstalls) {
      hasInstalls = true;
      installs += d.installs;
      installSpend += d.spend;
    }
    if (!best || d.net > best.net) best = d;
    if (!worst || d.net < worst.net) worst = d;
  }
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const d = days[i];
    if (!d.has) continue;
    if (d.net > 0) streak++;
    else break;
  }
  const net = revenue - spend;
  return {
    spend,
    revenue,
    net,
    roas: roasOf(revenue, spend),
    margin: revenue > 0 ? net / revenue : null,
    tracked,
    span: days.length,
    profitable,
    loss,
    avgSpend: tracked ? spend / tracked : 0,
    avgRevenue: tracked ? revenue / tracked : 0,
    avgNet: tracked ? net / tracked : 0,
    best,
    worst,
    installs,
    hasInstalls,
    cpi: installs > 0 ? installSpend / installs : null,
    streak,
  };
}

export function bucketKey(date: string, gran: Gran): string {
  if (gran === 'week') return startOfWeek(date);
  if (gran === 'month') return startOfMonth(date);
  return date;
}

export function bucketize(days: DayRow[], gran: Gran): Bucket[] {
  const out: Bucket[] = [];
  let cur: Bucket | undefined;
  for (const d of days) {
    const key = bucketKey(d.date, gran);
    if (!cur || cur.key !== key) {
      cur = { key, start: d.date, end: d.date, spend: 0, revenue: 0, net: 0, installs: 0, has: false, tracked: 0 };
      out.push(cur);
    }
    cur.end = d.date;
    if (d.has) {
      cur.has = true;
      cur.tracked++;
      cur.spend += d.spend;
      cur.revenue += d.revenue;
      cur.net += d.net;
      cur.installs += d.installs;
    }
  }
  return out;
}

export function bucketLabel(b: Bucket, gran: Gran, style: 'tick' | 'title'): string {
  if (gran === 'day') return style === 'tick' ? fmtDate(b.start, 'short') : fmtDate(b.start, 'long');
  if (gran === 'week') return style === 'tick' ? fmtDate(b.start, 'short') : `Week of ${fmtRange(b.start, b.end)}`;
  return style === 'tick' ? fmtDate(b.start, 'month') : fmtDate(b.start, 'monthLong');
}

/** Rolling ROAS = sum(revenue) / sum(spend) over the trailing window (not an average of ratios). */
export function rollingRoas(days: DayRow[], window: number): (number | null)[] {
  return days.map((_, i) => {
    let s = 0;
    let r = 0;
    let n = 0;
    for (let j = Math.max(0, i - window + 1); j <= i; j++) {
      if (!days[j].has) continue;
      s += days[j].spend;
      r += days[j].revenue;
      n++;
    }
    return n >= Math.min(2, window) ? roasOf(r, s) : null;
  });
}

// ---- Date ranges -----------------------------------------------------------

export type Preset = '7d' | '14d' | '30d' | '90d' | 'mtd' | 'lastMonth' | 'ytd' | 'all' | 'custom';

export interface RangePref {
  preset: Preset;
  start?: string;
  end?: string;
}

export interface Range {
  start: string;
  end: string;
  label: string;
  days: number;
}

export const PRESETS: { id: Preset; label: string; long: string }[] = [
  { id: '7d', label: '7D', long: 'Last 7 days' },
  { id: '14d', label: '14D', long: 'Last 14 days' },
  { id: '30d', label: '30D', long: 'Last 30 days' },
  { id: '90d', label: '90D', long: 'Last 90 days' },
  { id: 'mtd', label: 'MTD', long: 'Month to date' },
  { id: 'lastMonth', label: 'Last month', long: 'Last month' },
  { id: 'ytd', label: 'YTD', long: 'Year to date' },
  { id: 'all', label: 'All', long: 'All time' },
];

/** Ranges end at `anchor` — the latest day with data — so a missed update never leaves an empty tail. */
export function resolveRange(pref: RangePref, anchor: string, first: string): Range {
  let start: string;
  let end = anchor;
  let label = PRESETS.find((p) => p.id === pref.preset)?.long ?? 'Custom range';
  switch (pref.preset) {
    case '7d':
    case '14d':
    case '30d':
    case '90d':
      start = addDays(anchor, -(parseInt(pref.preset, 10) - 1));
      break;
    case 'mtd':
      start = startOfMonth(anchor);
      break;
    case 'lastMonth': {
      const prevEnd = addDays(startOfMonth(anchor), -1);
      start = startOfMonth(prevEnd);
      end = prevEnd;
      label = `${fmtDate(start, 'monthLong')}`;
      break;
    }
    case 'ytd':
      start = startOfYear(anchor);
      break;
    case 'all':
      start = minISO(first, anchor);
      break;
    case 'custom': {
      const a = pref.start ?? addDays(anchor, -29);
      const b = pref.end ?? anchor;
      start = minISO(a, b);
      end = maxISO(a, b);
      label = 'Custom range';
      break;
    }
  }
  return { start, end, label, days: diffDays(start, end) + 1 };
}

export function previousRange(r: Range): Range {
  const end = addDays(r.start, -1);
  const start = addDays(end, -(r.days - 1));
  return { start, end, label: `previous ${r.days} days`, days: r.days };
}

export function monthWindow(anchorDay: string) {
  return { start: startOfMonth(anchorDay), end: endOfMonth(anchorDay) };
}
