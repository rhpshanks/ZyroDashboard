// Add, update or remove a day's numbers in data/zyro.json.
//
//   npm run add -- --date 2026-10-12 --spend 12.50 --revenue 9.80
//   npm run add -- --date 2026-10-12 --game idle-empire --spend 8 --revenue 6.2 --installs 41 --note "New creative"
//   npm run add -- --date 2026-10-12 --spend-pkr 3500 --revenue 9.80        (converts PKR at settings.pkrPerUsd, or --rate)
//   npm run add -- --date 2026-10-12 --game idle-empire --remove
//
// The same date (+ game) is replaced rather than duplicated.
import { readData, writeData, validate, isISODate } from './data-file.mjs';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function money(v, name) {
  const n = Number(String(v).replace(/[$,\s]/g, ''));
  if (!Number.isFinite(n) || n < 0) fail(`--${name} must be a non-negative number (got "${v}")`);
  return Math.round(n * 100) / 100;
}

const args = parseArgs(process.argv.slice(2));
const data = readData();

if (!args.date || !isISODate(args.date)) fail('--date YYYY-MM-DD is required');
const date = args.date;
const game = typeof args.game === 'string' ? args.game : undefined;
if (game && !data.games.some((g) => g.id === game)) fail(`Unknown game "${game}". Known: ${data.games.map((g) => g.id).join(', ')}`);

const idx = data.entries.findIndex((e) => e.date === date && (e.game ?? undefined) === game);
const label = `${date}${game ? ' · ' + game : ''}`;

if (args.remove) {
  if (idx < 0) fail(`No entry for ${label}`);
  data.entries.splice(idx, 1);
  writeData(data);
  console.log(`removed ${label}`);
  process.exit(0);
}

const prev = idx >= 0 ? data.entries[idx] : undefined;
const rate = args.rate ? money(args.rate, 'rate') : data.settings.pkrPerUsd;
const notes = [];

let spend = prev?.spend;
if (args['spend-pkr'] !== undefined) {
  const pkr = money(args['spend-pkr'], 'spend-pkr');
  spend = Math.round((pkr / rate) * 100) / 100;
  notes.push(`spend Rs ${pkr.toLocaleString('en-US')} @ ${rate}`);
} else if (args.spend !== undefined) spend = money(args.spend, 'spend');

let revenue = prev?.revenue;
if (args['revenue-pkr'] !== undefined) {
  const pkr = money(args['revenue-pkr'], 'revenue-pkr');
  revenue = Math.round((pkr / rate) * 100) / 100;
  notes.push(`revenue Rs ${pkr.toLocaleString('en-US')} @ ${rate}`);
} else if (args.revenue !== undefined) revenue = money(args.revenue, 'revenue');

if (spend === undefined) fail('--spend (USD) or --spend-pkr is required for a new entry');
if (revenue === undefined) fail('--revenue (USD) or --revenue-pkr is required for a new entry');

const entry = { date, spend, revenue };
if (game) entry.game = game;
const installs = args.installs !== undefined ? Number(args.installs) : prev?.installs;
if (installs !== undefined) {
  if (!Number.isInteger(installs) || installs < 0) fail('--installs must be a whole number');
  entry.installs = installs;
}
// Keep the user's note; replace any earlier auto-added PKR conversion text for the field being re-entered.
const baseNote = (typeof args.note === 'string' ? args.note : prev?.note ?? '')
  .split(' · ')
  .filter((part) => !notes.some((n) => part.startsWith(n.split(' Rs ')[0] + ' Rs ')))
  .join(' · ');
const note = [baseNote, ...notes].filter(Boolean).join(' · ');
if (note) entry.note = note;

if (idx >= 0) data.entries[idx] = entry;
else data.entries.push(entry);

const problems = validate(data);
if (problems.length) fail(`Not saved:\n  - ${problems.join('\n  - ')}`);
writeData(data);

const net = revenue - spend;
const roas = spend > 0 ? `${Math.round((revenue / spend) * 100)}%` : 'n/a';
console.log(`${prev ? 'updated' : 'added'} ${label} · spend $${spend.toFixed(2)} · revenue $${revenue.toFixed(2)} · net ${net >= 0 ? '+' : '-'}$${Math.abs(net).toFixed(2)} · ROAS ${roas}`);
