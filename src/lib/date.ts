// All dates are calendar days as 'YYYY-MM-DD' strings, computed in UTC so
// daylight-saving and the viewer's timezone never shift a day.

export const DAY = 86_400_000;

const pad = (n: number) => String(n).padStart(2, '0');

export function toT(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export const toISO = (t: number) => new Date(t).toISOString().slice(0, 10);
export const addDays = (iso: string, n: number) => toISO(toT(iso) + n * DAY);
export const diffDays = (a: string, b: string) => Math.round((toT(b) - toT(a)) / DAY);
export const minISO = (a: string, b: string) => (a < b ? a : b);
export const maxISO = (a: string, b: string) => (a > b ? a : b);

export function eachDay(start: string, end: string): string[] {
  const out: string[] = [];
  for (let t = toT(start), e = toT(end); t <= e; t += DAY) out.push(toISO(t));
  return out;
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isISODate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && toISO(toT(s)) === s;
}

/** Monday = 0 … Sunday = 6 */
export const weekdayMon0 = (iso: string) => (new Date(toT(iso)).getUTCDay() + 6) % 7;
export const startOfWeek = (iso: string) => addDays(iso, -weekdayMon0(iso));
export const startOfMonth = (iso: string) => iso.slice(0, 8) + '01';
export function endOfMonth(iso: string): string {
  const [y, m] = iso.split('-').map(Number);
  return toISO(Date.UTC(y, m, 0));
}
export const daysInMonth = (iso: string) => Number(endOfMonth(iso).slice(8));
export const startOfYear = (iso: string) => iso.slice(0, 4) + '-01-01';

const formats = {
  short: { month: 'short', day: 'numeric' },
  medium: { month: 'short', day: 'numeric', year: 'numeric' },
  long: { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' },
  full: { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' },
  weekdayShort: { weekday: 'short', month: 'short', day: 'numeric' },
  month: { month: 'short' },
  monthLong: { month: 'long', year: 'numeric' },
  monthYear: { month: 'short', year: '2-digit' },
  weekday: { weekday: 'short' },
} satisfies Record<string, Intl.DateTimeFormatOptions>;

export type DateStyle = keyof typeof formats;
const cache = new Map<DateStyle, Intl.DateTimeFormat>();

export function fmtDate(iso: string, style: DateStyle = 'short'): string {
  let f = cache.get(style);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { ...formats[style], timeZone: 'UTC' });
    cache.set(style, f);
  }
  return f.format(new Date(toT(iso)));
}

export function fmtRange(start: string, end: string): string {
  if (start === end) return fmtDate(start, 'medium');
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  return `${fmtDate(start, sameYear ? 'short' : 'medium')} – ${fmtDate(end, 'medium')}`;
}

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
