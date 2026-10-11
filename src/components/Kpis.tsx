import type { ReactNode } from 'react';
import type { DayRow } from '../types';
import type { Fmt } from '../lib/format';
import { num, pct, signedPct, signedPts } from '../lib/format';
import type { Summary } from '../lib/metrics';
import { bucketize, roasOf } from '../lib/metrics';
import type { KpiId } from '../lib/prefs';
import { KPI_META } from '../lib/prefs';
import { fmtDate } from '../lib/date';
import { Icon, useWidth } from './ui';

export function Delta({
  value,
  text,
  suffix,
  good,
}: {
  value: number | null;
  text?: string;
  suffix?: string;
  good: 'up' | 'down' | 'neutral';
}) {
  if (value === null || !Number.isFinite(value)) {
    return <div className="delta muted">No earlier data to compare</div>;
  }
  const dir = value > 0 ? 'up' : value < 0 ? 'down' : 'flat';
  const tone = dir === 'flat' || good === 'neutral' ? 'neutral' : dir === good ? 'good' : 'bad';
  return (
    <div className={`delta ${tone}`}>
      {dir !== 'flat' ? <Icon name={dir === 'up' ? 'up' : 'down'} size={13} /> : null}
      <span className="delta-val">{text}</span>
      {suffix ? <span className="delta-suffix">{suffix}</span> : null}
    </div>
  );
}

function Sparkline({ values, color }: { values: (number | null)[]; color: string }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const h = 30;
  const pts = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v !== null);
  let body: ReactNode = null;
  if (w > 0 && pts.length > 1) {
    const min = Math.min(0, ...pts.map((p) => p.v));
    const max = Math.max(...pts.map((p) => p.v), min + 1e-9);
    const x = (i: number) => 3 + (i / Math.max(1, values.length - 1)) * (w - 6);
    const y = (v: number) => 3 + (1 - (v - min) / (max - min)) * (h - 6);
    const d = pts.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
    const last = pts[pts.length - 1];
    body = (
      <svg width={w} height={h} aria-hidden="true">
        {min < 0 ? <line x1={0} x2={w} y1={y(0)} y2={y(0)} className="spark-zero" /> : null}
        <path d={d} className="spark-line" />
        <circle cx={x(last.i)} cy={y(last.v)} r={3} fill={color} className="spark-dot" />
      </svg>
    );
  }
  return (
    <div className="spark" ref={ref}>
      {body}
    </div>
  );
}

interface MonthInfo {
  label: string;
  net: number;
  projection: number | null;
}

interface TileSpec {
  value: ReactNode;
  delta?: ReactNode;
  sub?: ReactNode;
  spark?: { values: (number | null)[]; color: string };
  meter?: number;
  onClick?: () => void;
}

const change = (a: number, b: number) => (b !== 0 ? (a - b) / Math.abs(b) : null);

export function KpiRow({
  ids,
  sum,
  prevSum,
  days,
  fmt,
  month,
  rangeDays,
  onPickDay,
}: {
  ids: KpiId[];
  sum: Summary;
  prevSum: Summary;
  days: DayRow[];
  fmt: Fmt;
  month: MonthInfo;
  rangeDays: number;
  onPickDay: (date: string) => void;
}) {
  const hasPrev = prevSum.tracked > 0;
  const vs = `vs prev ${rangeDays}d`;
  // Keep sparklines legible: long ranges collapse to weekly points.
  const series = days.length > 60 ? bucketize(days, 'week') : days;
  const sv = (f: (d: { spend: number; revenue: number; net: number; has: boolean }) => number | null) =>
    series.map((d) => (d.has ? f(d) : null));

  const pctDelta = (a: number, b: number, good: 'up' | 'down' | 'neutral') => {
    const c = hasPrev ? change(a, b) : null;
    return <Delta value={c} text={signedPct(c)} suffix={vs} good={good} />;
  };
  const moneyDelta = (a: number, b: number) => (
    <Delta value={hasPrev ? a - b : null} text={fmt.money(a - b, { sign: true })} suffix={vs} good="up" />
  );

  const spec = (id: KpiId): TileSpec => {
    switch (id) {
      case 'spend':
        return { value: fmt.money(sum.spend), delta: pctDelta(sum.spend, prevSum.spend, 'neutral'), spark: { values: sv((d) => d.spend), color: 'var(--spend)' } };
      case 'revenue':
        return { value: fmt.money(sum.revenue), delta: pctDelta(sum.revenue, prevSum.revenue, 'up'), spark: { values: sv((d) => d.revenue), color: 'var(--revenue)' } };
      case 'net':
        return { value: fmt.money(sum.net, { sign: true }), delta: moneyDelta(sum.net, prevSum.net), spark: { values: sv((d) => d.net), color: 'var(--net)' } };
      case 'roas':
        return {
          value: pct(sum.roas),
          delta: (
            <Delta
              value={hasPrev && sum.roas !== null && prevSum.roas !== null ? sum.roas - prevSum.roas : null}
              text={signedPts(sum.roas !== null && prevSum.roas !== null ? sum.roas - prevSum.roas : null)}
              suffix={vs}
              good="up"
            />
          ),
          spark: { values: sv((d) => roasOf(d.revenue, d.spend)), color: 'var(--net)' },
        };
      case 'profitableDays':
        return {
          value: (
            <>
              {sum.profitable}
              <span className="kpi-of"> / {sum.tracked}</span>
            </>
          ),
          sub: sum.tracked ? `${pct(sum.profitable / sum.tracked)} of tracked days in profit` : 'No tracked days',
          meter: sum.tracked ? sum.profitable / sum.tracked : 0,
        };
      case 'avgSpend':
        return { value: fmt.money(sum.avgSpend), delta: pctDelta(sum.avgSpend, prevSum.avgSpend, 'neutral'), sub: 'per tracked day' };
      case 'avgRevenue':
        return { value: fmt.money(sum.avgRevenue), delta: pctDelta(sum.avgRevenue, prevSum.avgRevenue, 'up'), sub: 'per tracked day' };
      case 'avgNet':
        return {
          value: fmt.money(sum.avgNet, { sign: true }),
          delta: moneyDelta(sum.avgNet, prevSum.avgNet),
          spark: { values: sv((d) => d.net), color: 'var(--net)' },
        };
      case 'bestDay':
        return sum.best
          ? { value: fmt.money(sum.best.net, { sign: true }), sub: fmtDate(sum.best.date, 'long'), onClick: () => onPickDay(sum.best!.date) }
          : { value: '—', sub: 'No tracked days' };
      case 'worstDay':
        return sum.worst
          ? { value: fmt.money(sum.worst.net, { sign: true }), sub: fmtDate(sum.worst.date, 'long'), onClick: () => onPickDay(sum.worst!.date) }
          : { value: '—', sub: 'No tracked days' };
      case 'projection':
        return {
          value: month.projection === null ? '—' : fmt.money(month.projection, { sign: true }),
          sub: month.projection === null ? `No entries in ${month.label} yet` : `${month.label} at current pace · ${fmt.money(month.net, { sign: true })} so far`,
        };
      case 'margin':
        return {
          value: pct(sum.margin),
          delta: (
            <Delta
              value={hasPrev && sum.margin !== null && prevSum.margin !== null ? sum.margin - prevSum.margin : null}
              text={signedPts(sum.margin !== null && prevSum.margin !== null ? sum.margin - prevSum.margin : null)}
              suffix={vs}
              good="up"
            />
          ),
          sub: 'of revenue kept after ad spend',
        };
      case 'streak':
        return { value: `${sum.streak} ${sum.streak === 1 ? 'day' : 'days'}`, sub: 'profitable in a row, up to the latest entry' };
      case 'installs':
        return sum.hasInstalls
          ? { value: num(sum.installs), delta: pctDelta(sum.installs, prevSum.installs, 'up') }
          : { value: '—', sub: 'Include installs in your daily update to see this' };
      case 'cpi':
        return sum.cpi !== null
          ? { value: fmt.money(sum.cpi), delta: pctDelta(sum.cpi, prevSum.cpi ?? 0, 'down'), sub: 'spend ÷ installs' }
          : { value: '—', sub: 'Include installs in your daily update to see this' };
    }
  };

  return (
    <section className="panel wide kpis" aria-label="Key numbers" data-panel="kpis">
      {ids.map((id) => {
        const t = spec(id);
        const Tag = t.onClick ? 'button' : 'div';
        return (
          <Tag key={id} className={`kpi ${t.onClick ? 'kpi-link' : ''}`} onClick={t.onClick} type={t.onClick ? 'button' : undefined}>
            <div className="kpi-label">{KPI_META[id]}</div>
            <div className="kpi-value">{t.value}</div>
            {t.delta ?? null}
            {t.sub ? <div className="kpi-sub">{t.sub}</div> : null}
            {t.meter !== undefined ? (
              <div className="meter" aria-hidden="true">
                <div className="meter-fill" style={{ width: `${t.meter * 100}%` }} />
              </div>
            ) : null}
            {t.spark ? <Sparkline values={t.spark.values} color={t.spark.color} /> : null}
          </Tag>
        );
      })}
      {ids.length === 0 ? <div className="kpi-empty">No tiles selected. Pick some under Customize.</div> : null}
    </section>
  );
}
