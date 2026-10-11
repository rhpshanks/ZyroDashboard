import { useCallback, useEffect, useState } from 'react';
import type { Currency } from './format';
import type { RangePref } from './metrics';
import type { Gran } from '../types';

export type PanelId =
  | 'hero'
  | 'kpis'
  | 'daily'
  | 'payback'
  | 'roas'
  | 'calendar'
  | 'weekday'
  | 'games'
  | 'goals'
  | 'simulator'
  | 'ledger';

export interface PanelPref {
  id: PanelId;
  visible: boolean;
  wide: boolean;
}

export type KpiId =
  | 'spend'
  | 'revenue'
  | 'net'
  | 'roas'
  | 'profitableDays'
  | 'avgSpend'
  | 'avgRevenue'
  | 'avgNet'
  | 'bestDay'
  | 'worstDay'
  | 'projection'
  | 'margin'
  | 'streak'
  | 'installs'
  | 'cpi';

export interface Prefs {
  theme: 'dark' | 'light' | 'system';
  palette: 'zyro' | 'cvd';
  density: 'comfy' | 'compact';
  motion: boolean;
  currency: Currency;
  pkrPerUsd: number | null;
  monthlyProfitGoal: number | null;
  monthlySpendBudget: number | null;
  range: RangePref;
  games: string[];
  panels: PanelPref[];
  kpis: KpiId[];
  daily: {
    gran: Gran | 'auto';
    mode: 'bars' | 'lines' | 'area';
    cumulative: boolean;
    avg: boolean;
    show: { spend: boolean; revenue: boolean; net: boolean };
  };
  roasWindow: number;
  weekdayMetric: 'net' | 'roas' | 'spend' | 'revenue';
}

export const PANEL_META: Record<PanelId, { title: string; blurb: string; fixedWide?: boolean }> = {
  hero: { title: 'Return on ad spend', blurb: 'Net profit and what each ad dollar brought back', fixedWide: true },
  kpis: { title: 'Key numbers', blurb: 'Tiles you pick, compared with the previous period', fixedWide: true },
  daily: { title: 'Spend vs revenue', blurb: 'Daily, weekly or monthly; drag across it to zoom' },
  payback: { title: 'Payback curve', blurb: 'Running profit across the range' },
  roas: { title: 'ROAS trend', blurb: 'Daily ROAS with a rolling average' },
  calendar: { title: 'Profit calendar', blurb: 'Every day coloured by profit or loss' },
  weekday: { title: 'Day-of-week pattern', blurb: 'Which weekdays earn the most' },
  games: { title: 'By game', blurb: 'Spend and revenue for each title' },
  goals: { title: 'Monthly goals', blurb: 'Profit target and spend budget pacing' },
  simulator: { title: 'Scale simulator', blurb: 'What happens if you change daily spend' },
  ledger: { title: 'Ledger', blurb: 'Every entry, sortable and exportable' },
};

export const KPI_META: Record<KpiId, string> = {
  spend: 'Ad spend',
  revenue: 'AdMob revenue',
  net: 'Net profit',
  roas: 'ROAS',
  profitableDays: 'Profitable days',
  avgSpend: 'Avg daily spend',
  avgRevenue: 'Avg daily revenue',
  avgNet: 'Avg daily profit',
  bestDay: 'Best day',
  worstDay: 'Worst day',
  projection: 'Month-end projection',
  margin: 'Profit margin',
  streak: 'Profit streak',
  installs: 'Installs',
  cpi: 'Cost per install',
};

export const DEFAULT_PANELS: PanelPref[] = [
  { id: 'hero', visible: true, wide: true },
  { id: 'kpis', visible: true, wide: true },
  { id: 'daily', visible: true, wide: true },
  { id: 'payback', visible: true, wide: false },
  { id: 'roas', visible: true, wide: false },
  { id: 'calendar', visible: true, wide: false },
  { id: 'weekday', visible: true, wide: false },
  { id: 'games', visible: true, wide: false },
  { id: 'goals', visible: true, wide: false },
  { id: 'simulator', visible: true, wide: true },
  { id: 'ledger', visible: true, wide: true },
];

export const DEFAULT_PREFS: Prefs = {
  theme: 'dark',
  palette: 'zyro',
  density: 'comfy',
  motion: true,
  currency: 'USD',
  pkrPerUsd: null,
  monthlyProfitGoal: null,
  monthlySpendBudget: null,
  range: { preset: '30d' },
  games: [],
  panels: DEFAULT_PANELS,
  kpis: ['spend', 'revenue', 'roas', 'profitableDays', 'avgNet', 'projection'],
  daily: { gran: 'auto', mode: 'bars', cumulative: false, avg: true, show: { spend: true, revenue: true, net: true } },
  roasWindow: 7,
  weekdayMetric: 'net',
};

const KEY = 'zyro.prefs.v1';

/** Merge saved prefs onto defaults so panels or fields added later still appear. */
function hydrate(raw: unknown): Prefs {
  if (!raw || typeof raw !== 'object') return DEFAULT_PREFS;
  const saved = raw as Partial<Prefs>;
  const merged: Prefs = {
    ...DEFAULT_PREFS,
    ...saved,
    daily: { ...DEFAULT_PREFS.daily, ...saved.daily, show: { ...DEFAULT_PREFS.daily.show, ...saved.daily?.show } },
    range: saved.range?.preset ? saved.range : DEFAULT_PREFS.range,
  };
  const known = new Set(DEFAULT_PANELS.map((p) => p.id));
  const panels = (Array.isArray(saved.panels) ? saved.panels : []).filter((p) => known.has(p.id));
  for (const p of DEFAULT_PANELS) if (!panels.some((q) => q.id === p.id)) panels.push(p);
  merged.panels = panels;
  merged.kpis = (Array.isArray(saved.kpis) ? saved.kpis : DEFAULT_PREFS.kpis).filter((k) => k in KPI_META);
  merged.games = Array.isArray(saved.games) ? saved.games : [];
  return merged;
}

function load(): Prefs {
  try {
    const s = localStorage.getItem(KEY);
    return hydrate(s ? JSON.parse(s) : null);
  } catch {
    return DEFAULT_PREFS;
  }
}

export function usePrefs() {
  const [prefs, setPrefsState] = useState<Prefs>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {
      /* storage unavailable (private mode) — prefs just won't persist */
    }
    const root = document.documentElement;
    root.dataset.theme = prefs.theme;
    root.dataset.palette = prefs.palette;
    root.dataset.density = prefs.density;
    root.dataset.motion = prefs.motion ? 'on' : 'off';
  }, [prefs]);

  const update = useCallback((patch: Partial<Prefs> | ((p: Prefs) => Partial<Prefs>)) => {
    setPrefsState((p) => ({ ...p, ...(typeof patch === 'function' ? patch(p) : patch) }));
  }, []);

  const reset = useCallback((part?: 'layout' | 'all') => {
    setPrefsState((p) =>
      part === 'layout' ? { ...p, panels: DEFAULT_PANELS, kpis: DEFAULT_PREFS.kpis } : { ...DEFAULT_PREFS },
    );
  }, []);

  return [prefs, update, reset] as const;
}
