// Shared helpers for reading, checking and writing data/zyro.json.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const DATA_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'zyro.json');

const ENTRY_KEYS = ['date', 'game', 'spend', 'revenue', 'installs', 'note'];

export function readData() {
  return JSON.parse(readFileSync(DATA_PATH, 'utf8'));
}

export function isISODate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.toISOString().slice(0, 10) === s;
}

/** Returns a list of human-readable problems; empty means the file is valid. */
export function validate(data) {
  const problems = [];
  const s = data.settings ?? {};
  for (const k of ['pkrPerUsd', 'monthlyProfitGoal', 'monthlySpendBudget']) {
    if (typeof s[k] !== 'number' || !Number.isFinite(s[k]) || s[k] < 0) problems.push(`settings.${k} must be a non-negative number`);
  }
  const gameIds = new Set();
  for (const [i, g] of (data.games ?? []).entries()) {
    if (!g.id || !g.name || !g.short) problems.push(`games[${i}] needs id, name and short`);
    if (gameIds.has(g.id)) problems.push(`games[${i}] duplicate id "${g.id}"`);
    gameIds.add(g.id);
  }
  if (!Array.isArray(data.entries)) {
    problems.push('entries must be an array');
    return problems;
  }
  const seen = new Set();
  for (const [i, e] of data.entries.entries()) {
    const where = `entries[${i}] (${e.date ?? 'no date'}${e.game ? ' · ' + e.game : ''})`;
    if (!isISODate(e.date)) problems.push(`${where}: date must be YYYY-MM-DD`);
    for (const k of ['spend', 'revenue']) {
      if (typeof e[k] !== 'number' || !Number.isFinite(e[k]) || e[k] < 0) problems.push(`${where}: ${k} must be a non-negative number`);
    }
    if (e.installs !== undefined && (!Number.isInteger(e.installs) || e.installs < 0)) problems.push(`${where}: installs must be a whole number`);
    if (e.game !== undefined && !gameIds.has(e.game)) problems.push(`${where}: unknown game "${e.game}" (known: ${[...gameIds].join(', ')})`);
    if (e.note !== undefined && typeof e.note !== 'string') problems.push(`${where}: note must be text`);
    for (const k of Object.keys(e)) if (!ENTRY_KEYS.includes(k)) problems.push(`${where}: unexpected field "${k}"`);
    const key = `${e.date}|${e.game ?? ''}`;
    if (seen.has(key)) problems.push(`${where}: duplicate entry for this date${e.game ? ' and game' : ''}`);
    seen.add(key);
  }
  return problems;
}

export function sortEntries(entries) {
  return entries.sort((a, b) => (a.date === b.date ? (a.game ?? '').localeCompare(b.game ?? '') : a.date.localeCompare(b.date)));
}

/** Pretty JSON, but one entry per line so daily diffs stay readable. */
export function writeData(data) {
  const entries = sortEntries(data.entries).map((e) => {
    const ordered = {};
    for (const k of ENTRY_KEYS) if (e[k] !== undefined) ordered[k] = e[k];
    return '    ' + JSON.stringify(ordered);
  });
  const { entries: _omit, ...rest } = data;
  const head = JSON.stringify(rest, null, 2).replace(/\n}$/, '');
  const body = entries.length ? `[\n${entries.join(',\n')}\n  ]` : '[]';
  writeFileSync(DATA_PATH, `${head},\n  "entries": ${body}\n}\n`);
}
