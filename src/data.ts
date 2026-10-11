import raw from '../data/zyro.json';
import type { Dataset, Entry } from './types';
import { addDays, todayISO, weekdayMon0 } from './lib/date';

export const dataset = raw as Dataset;

/** Deterministic PRNG so the sample looks the same on every visit. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Sample data shown only while data/zyro.json has no entries: three titles launched
 * at different times, spend ramping up, ROAS climbing past break-even as campaigns learn.
 */
export function makeDemoEntries(days = 84): Entry[] {
  const rand = mulberry32(2026);
  const end = todayISO();
  const start = addDays(end, -(days - 1));
  const titles = [
    { id: 'idle-empire', from: 0, spend: [6, 22], roas: [0.5, 1.24], cpi: 0.14 },
    { id: 'gate-war', from: 24, spend: [4, 12], roas: [0.45, 1.02], cpi: 0.11 },
    { id: 'arrow-out', from: 52, spend: [3, 9], roas: [0.6, 1.16], cpi: 0.09 },
  ];
  const notes: Record<number, string> = {
    9: 'Swapped to playable creative',
    24: 'Gate War campaign launched',
    37: 'Raised target CPI bid',
    52: 'Arrow Out soft launch',
    66: 'Added rewarded ad on level fail',
  };
  const out: Entry[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(start, i);
    const weekend = weekdayMon0(date) >= 5 ? 1.12 : 1;
    for (const t of titles) {
      if (i < t.from) continue;
      const age = Math.min(1, (i - t.from) / 40);
      const spend = round2((t.spend[0] + (t.spend[1] - t.spend[0]) * age) * (0.82 + rand() * 0.36));
      const roas = (t.roas[0] + (t.roas[1] - t.roas[0]) * Math.sqrt(age)) * weekend * (0.68 + rand() * 0.64);
      const entry: Entry = {
        date,
        game: t.id,
        spend,
        revenue: round2(spend * roas),
        installs: Math.round((spend / t.cpi) * (0.85 + rand() * 0.3)),
      };
      if (t.id === 'idle-empire' && notes[i]) entry.note = notes[i];
      if (t.id !== 'idle-empire' && i === t.from) entry.note = notes[i];
      out.push(entry);
    }
  }
  return out;
}
