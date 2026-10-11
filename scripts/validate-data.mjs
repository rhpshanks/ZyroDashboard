// Fails the build if data/zyro.json is malformed, so a bad edit never ships.
import { readData, validate } from './data-file.mjs';

let data;
try {
  data = readData();
} catch (err) {
  console.error(`data/zyro.json is not valid JSON: ${err.message}`);
  process.exit(1);
}

const problems = validate(data);
if (problems.length) {
  console.error(`data/zyro.json has ${problems.length} problem(s):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

const n = data.entries.length;
const spend = data.entries.reduce((s, e) => s + e.spend, 0);
const revenue = data.entries.reduce((s, e) => s + e.revenue, 0);
const last = n ? data.entries.map((e) => e.date).sort().at(-1) : 'none';
console.log(`data ok · ${n} entries · last ${last} · spend $${spend.toFixed(2)} · revenue $${revenue.toFixed(2)} · net ${revenue - spend < 0 ? '-' : '+'}$${Math.abs(revenue - spend).toFixed(2)}`);
