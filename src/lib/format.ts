export type Currency = 'USD' | 'PKR';

const MINUS = '−';

export interface Fmt {
  currency: Currency;
  symbol: string;
  /** Full money value, e.g. $1,234.56 / Rs 345,600 */
  money(v: number, opts?: { sign?: boolean; compact?: boolean }): string;
  /** Short value for axes, e.g. $1.2K */
  axis(v: number): string;
  /** Tight-spot value with at most one decimal, e.g. +$4.2 / +$17 / -$1.2K */
  short(v: number, sign?: boolean): string;
}

function compactNumber(abs: number, decimals: number): string {
  if (abs >= 1e6) return trim((abs / 1e6).toFixed(abs >= 1e7 ? 0 : 1)) + 'M';
  if (abs >= 1e3) return trim((abs / 1e3).toFixed(abs >= 1e4 ? 0 : 1)) + 'K';
  return abs.toFixed(decimals);
}
const trim = (s: string) => s.replace(/\.0$/, '');

export function makeFmt(currency: Currency): Fmt {
  const symbol = currency === 'USD' ? '$' : 'Rs ';
  const decimals = currency === 'USD' ? 2 : 0;
  const full = new Intl.NumberFormat('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  const money: Fmt['money'] = (v, opts = {}) => {
    const abs = Math.abs(v);
    const body = opts.compact && abs >= 1000 ? compactNumber(abs, decimals) : full.format(abs);
    const rounded = Number(abs.toFixed(decimals));
    const sign = v < 0 && rounded !== 0 ? MINUS : opts.sign && rounded !== 0 ? '+' : '';
    return `${sign}${symbol}${body}`;
  };

  const axis: Fmt['axis'] = (v) => {
    const abs = Math.abs(v);
    const d = currency === 'USD' && abs > 0 && abs < 10 && !Number.isInteger(abs) ? 1 : 0;
    const body = abs >= 1000 ? compactNumber(abs, 0) : abs.toFixed(abs < 1 && abs > 0 && currency === 'USD' ? 2 : d);
    return `${v < 0 ? MINUS : ''}${symbol}${body}`;
  };

  const short: Fmt['short'] = (v, withSign = false) => {
    const abs = Math.abs(v);
    let body: string;
    if (abs >= 1000) body = compactNumber(abs, 0);
    else if (currency === 'PKR' || abs >= 10) body = String(Math.round(abs));
    else body = trim(abs.toFixed(1));
    const zero = body === '0';
    const sign = v < 0 && !zero ? MINUS : withSign && v > 0 && !zero ? '+' : '';
    return `${sign}${symbol}${body}`;
  };

  return { currency, symbol, money, axis, short };
}

export function pct(v: number | null | undefined, decimals = 0): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return `${(v * 100).toFixed(decimals)}%`;
}

export function signedPct(v: number | null | undefined, decimals = 0): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  const s = (Math.abs(v) * 100).toFixed(decimals);
  if (Number(s) === 0) return `0%`;
  return `${v < 0 ? MINUS : '+'}${s}%`;
}

/** Percentage-point change for ratios like ROAS (0.12 -> "+12 pts"). */
export function signedPts(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  const s = Math.round(Math.abs(v) * 100);
  if (s === 0) return '0 pts';
  return `${v < 0 ? MINUS : '+'}${s} pts`;
}

export const num = (v: number) => new Intl.NumberFormat('en-US').format(Math.round(v));

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
