import { useId, useMemo } from 'react';
import { scaleLinear } from 'd3-scale';
import { area, curveMonotoneX, line } from 'd3-shape';
import type { DayRow } from '../../types';
import type { Fmt } from '../../lib/format';
import { pct } from '../../lib/format';
import { roasOf, rollingRoas } from '../../lib/metrics';
import { fmtDate } from '../../lib/date';
import { ChartTooltip, Panel, Segmented, tickIndices, useKeyNav, useWidth, type TipRow } from '../ui';

const M = { top: 14, right: 16, bottom: 28, left: 54 };
const H = 250;

function useXScale(n: number, plotW: number) {
  return useMemo(() => {
    const s = scaleLinear().domain([0, Math.max(1, n - 1)]).range(n === 1 ? [plotW / 2, plotW / 2] : [0, plotW]);
    return s;
  }, [n, plotW]);
}

function HitLayer({
  plotW,
  plotH,
  n,
  setActive,
  onPick,
}: {
  plotW: number;
  plotH: number;
  n: number;
  setActive: (i: number | null) => void;
  onPick: (i: number) => void;
}) {
  const idx = (e: React.MouseEvent<SVGRectElement>) => {
    const px = e.clientX - e.currentTarget.getBoundingClientRect().left;
    return Math.max(0, Math.min(n - 1, Math.round((px / Math.max(1, plotW)) * (n - 1))));
  };
  return (
    <rect
      className="hit"
      width={plotW}
      height={plotH}
      onPointerMove={(e) => setActive(idx(e))}
      onPointerDown={(e) => setActive(idx(e))}
      onPointerLeave={() => setActive(null)}
      onClick={(e) => onPick(idx(e))}
    />
  );
}

function XTicks({ days, x, plotW, plotH }: { days: DayRow[]; x: (i: number) => number; plotW: number; plotH: number }) {
  return (
    <>
      {tickIndices(days.length, plotW, 70).map((i) => {
        const tx = x(i);
        const anchor = tx < 24 ? 'start' : tx > plotW - 24 ? 'end' : 'middle';
        return (
          <text key={i} x={tx} y={plotH + 19} className="tick" textAnchor={anchor}>
            {fmtDate(days[i].date, 'short')}
          </text>
        );
      })}
    </>
  );
}

// ---- Payback curve ----------------------------------------------------------------

export function PaybackPanel({ days, fmt, wide, onPickDay }: { days: DayRow[]; fmt: Fmt; wide: boolean; onPickDay: (d: string) => void }) {
  const uid = useId().replace(/:/g, '');
  const [ref, width] = useWidth<HTMLDivElement>();
  const n = days.length;
  const plotW = Math.max(10, width - M.left - M.right);
  const plotH = H - M.top - M.bottom;

  const run = useMemo(() => {
    let net = 0;
    let s = 0;
    let r = 0;
    let started = false;
    return days.map((d) => {
      if (d.has) {
        started = true;
        net += d.net;
        s += d.spend;
        r += d.revenue;
      }
      return started ? { net, spend: s, revenue: r } : null;
    });
  }, [days]);

  const defined = run.filter((v): v is NonNullable<typeof v> => v !== null);
  const x = useXScale(n, plotW);
  const y = useMemo(() => {
    const vals = [0, ...defined.map((v) => v.net)];
    let lo = Math.min(...vals);
    let hi = Math.max(...vals);
    if (lo === hi) hi = lo + 1;
    return scaleLinear().domain([lo, hi]).range([plotH, 0]).nice(5);
  }, [defined, plotH]);
  const y0 = y(0);

  // First day the running total climbs back to or above zero after being negative.
  let crossing = -1;
  let wasNeg = false;
  run.forEach((v, i) => {
    if (!v || crossing >= 0) return;
    if (v.net < 0) wasNeg = true;
    else if (wasNeg) crossing = i;
  });
  const lastIdx = run.map((v, i) => (v ? i : -1)).filter((i) => i >= 0).at(-1) ?? -1;
  const last = lastIdx >= 0 ? run[lastIdx]! : null;

  const status = !last
    ? 'No entries in this range'
    : last.net >= 0
      ? crossing >= 0
        ? `Ad spend paid back on ${fmtDate(days[crossing].date, 'short')}`
        : 'In profit for the whole range'
      : `${fmt.money(-last.net)} still to recover`;

  const lineD =
    line<(typeof run)[number]>()
      .defined((v) => v !== null)
      .x((_, i) => x(i))
      .y((v) => y(v!.net))(run) ?? '';
  const areaD =
    area<(typeof run)[number]>()
      .defined((v) => v !== null)
      .x((_, i) => x(i))
      .y0(y0)
      .y1((v) => y(v!.net))(run) ?? '';

  const nav = useKeyNav(n, (i) => days[i].has && onPickDay(days[i].date));
  const a = nav.active;
  const tipRows: TipRow[] | null =
    a !== null && run[a]
      ? [
          { key: 'net', label: 'Running profit', value: fmt.money(run[a]!.net, { sign: true }), color: 'var(--net)' },
          { key: 'rev', label: 'Running revenue', value: fmt.money(run[a]!.revenue), color: 'var(--revenue)', mark: 'rect' },
          { key: 'sp', label: 'Running spend', value: fmt.money(run[a]!.spend), color: 'var(--spend)', mark: 'rect' },
        ]
      : null;

  return (
    <Panel id="payback" title="Payback curve" sub={status} wide={wide}>
      <div
        className="chart"
        ref={ref}
        style={{ height: H }}
        tabIndex={0}
        role="application"
        aria-label={`Payback curve. ${status}. Arrow keys move between days.`}
        onKeyDown={nav.onKeyDown}
        onBlur={() => nav.setActive(null)}
      >
        {width > 0 && last ? (
          <svg width={width} height={H} className="viz">
            <defs>
              <clipPath id={`${uid}-above`}>
                <rect x={0} y={-10} width={plotW} height={Math.max(0, y0 + 10)} />
              </clipPath>
              <clipPath id={`${uid}-below`}>
                <rect x={0} y={y0} width={plotW} height={Math.max(0, plotH - y0 + 10)} />
              </clipPath>
            </defs>
            <g transform={`translate(${M.left},${M.top})`}>
              {y.ticks(5).map((t) => (
                <g key={t} transform={`translate(0,${y(t)})`}>
                  <line x2={plotW} className={t === 0 ? 'axis-line' : 'grid-line'} />
                  <text x={-10} dy="0.32em" className="tick" textAnchor="end">
                    {fmt.axis(t)}
                  </text>
                </g>
              ))}
              <path d={areaD} clipPath={`url(#${uid}-above)`} className="area-fill" style={{ fill: 'var(--revenue)' }} />
              <path d={areaD} clipPath={`url(#${uid}-below)`} className="area-fill" style={{ fill: 'var(--spend)' }} />
              <path d={lineD} className="series-line net-line" />
              {crossing >= 0 ? (
                <g transform={`translate(${x(crossing)},${y(run[crossing]!.net)})`}>
                  <circle r={5} className="mark-dot" />
                  <text y={-12} className="annot" textAnchor={x(crossing) > plotW - 60 ? 'end' : x(crossing) < 60 ? 'start' : 'middle'}>
                    Paid back · {fmtDate(days[crossing].date, 'short')}
                  </text>
                </g>
              ) : null}
              <circle cx={x(lastIdx)} cy={y(last.net)} r={4} className="end-dot" />
              {a !== null && run[a] ? (
                <g>
                  <line x1={x(a)} x2={x(a)} y1={0} y2={plotH} className="crosshair" />
                  <circle cx={x(a)} cy={y(run[a]!.net)} r={4.5} className="hover-dot" style={{ fill: 'var(--net)' }} />
                </g>
              ) : null}
              <XTicks days={days} x={x} plotW={plotW} plotH={plotH} />
              <HitLayer plotW={plotW} plotH={plotH} n={n} setActive={nav.setActive} onPick={(i) => days[i].has && onPickDay(days[i].date)} />
            </g>
          </svg>
        ) : null}
        {width > 0 && !last ? <div className="chart-empty">No entries in this range.</div> : null}
        {a !== null && tipRows ? (
          <ChartTooltip x={M.left + x(a)} y={M.top} width={width} title={fmtDate(days[a].date, 'long')} rows={tipRows} />
        ) : null}
      </div>
    </Panel>
  );
}

// ---- ROAS trend ----------------------------------------------------------------------

export function RoasPanel({
  days,
  windowSize,
  setWindow,
  fmt,
  wide,
  onPickDay,
}: {
  days: DayRow[];
  windowSize: number;
  setWindow: (n: number) => void;
  fmt: Fmt;
  wide: boolean;
  onPickDay: (d: string) => void;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const n = days.length;
  const plotW = Math.max(10, width - M.left - M.right);
  const plotH = H - M.top - M.bottom;
  const daily = useMemo(() => days.map((d) => (d.has ? roasOf(d.revenue, d.spend) : null)), [days]);
  const roll = useMemo(() => rollingRoas(days, windowSize), [days, windowSize]);
  const x = useXScale(n, plotW);

  const y = useMemo(() => {
    const vals = [...daily, ...roll].filter((v): v is number => v !== null).sort((p, q) => p - q);
    const p95 = vals.length ? vals[Math.floor((vals.length - 1) * 0.95)] : 1;
    const hi = Math.min(5, Math.max(1.5, p95 * 1.1, (roll.filter((v): v is number => v !== null).at(-1) ?? 0) * 1.15));
    return scaleLinear().domain([0, hi]).range([plotH, 0]).nice(5);
  }, [daily, roll, plotH]);
  const top = y.domain()[1];
  const yc = (v: number) => y(Math.min(v, top));

  const rollD =
    line<number | null>()
      .defined((v) => v !== null)
      .x((_, i) => x(i))
      .y((v) => yc(v!))
      .curve(curveMonotoneX)(roll) ?? '';

  const lastRoll = roll.filter((v): v is number => v !== null).at(-1);
  const hasAny = daily.some((v) => v !== null);
  const nav = useKeyNav(n, (i) => days[i].has && onPickDay(days[i].date));
  const a = nav.active;

  const tools = (
    <Segmented
      label="Rolling window"
      size="sm"
      value={windowSize}
      onChange={setWindow}
      options={[
        { value: 3, label: '3D' },
        { value: 7, label: '7D' },
        { value: 14, label: '14D' },
      ]}
    />
  );

  return (
    <Panel
      id="roas"
      title="ROAS trend"
      sub={lastRoll !== undefined ? `Rolling ${windowSize}-day ROAS is ${pct(lastRoll)}. Above 100% means ads pay for themselves.` : 'Above 100% means ads pay for themselves.'}
      tools={tools}
      wide={wide}
    >
      <div
        className="chart"
        ref={ref}
        style={{ height: H }}
        tabIndex={0}
        role="application"
        aria-label="ROAS trend. Arrow keys move between days."
        onKeyDown={nav.onKeyDown}
        onBlur={() => nav.setActive(null)}
      >
        {width > 0 && hasAny ? (
          <svg width={width} height={H} className="viz">
            <g transform={`translate(${M.left},${M.top})`}>
              <rect x={0} y={0} width={plotW} height={Math.max(0, y(1))} className="zone zone-good" />
              <rect x={0} y={y(1)} width={plotW} height={Math.max(0, plotH - y(1))} className="zone zone-bad" />
              {y.ticks(5).map((t) => (
                <g key={t} transform={`translate(0,${y(t)})`}>
                  <line x2={plotW} className={t === 0 ? 'axis-line' : 'grid-line'} />
                  <text x={-10} dy="0.32em" className="tick" textAnchor="end">
                    {pct(t)}
                  </text>
                </g>
              ))}
              <line x2={plotW} y1={y(1)} y2={y(1)} className="ref-line" />
              <text x={plotW - 4} y={y(1) - 6} className="annot" textAnchor="end">
                Break-even 100%
              </text>
              {daily.map((v, i) =>
                v === null ? null : (
                  <circle
                    key={i}
                    cx={x(i)}
                    cy={yc(v)}
                    r={n > 60 ? 2.5 : 3.5}
                    className={`roas-dot ${v > top ? 'clipped' : ''}`}
                    style={{ fill: v >= 1 ? 'var(--revenue)' : 'var(--spend)' }}
                  />
                ),
              )}
              <path d={rollD} className="series-line net-line" />
              {a !== null ? (
                <g>
                  <line x1={x(a)} x2={x(a)} y1={0} y2={plotH} className="crosshair" />
                  {roll[a] !== null ? <circle cx={x(a)} cy={yc(roll[a]!)} r={4.5} className="hover-dot" style={{ fill: 'var(--net)' }} /> : null}
                </g>
              ) : null}
              <XTicks days={days} x={x} plotW={plotW} plotH={plotH} />
              <HitLayer plotW={plotW} plotH={plotH} n={n} setActive={nav.setActive} onPick={(i) => days[i].has && onPickDay(days[i].date)} />
            </g>
          </svg>
        ) : null}
        {width > 0 && !hasAny ? <div className="chart-empty">No ad spend in this range.</div> : null}
        {a !== null ? (
          <ChartTooltip
            x={M.left + x(a)}
            y={M.top}
            width={width}
            title={fmtDate(days[a].date, 'long')}
            rows={
              days[a].has
                ? [
                    { key: 'roll', label: `Rolling ${windowSize}-day ROAS`, value: pct(roll[a]), color: 'var(--net)' },
                    { key: 'day', label: 'Daily ROAS', value: pct(daily[a]), color: (daily[a] ?? 0) >= 1 ? 'var(--revenue)' : 'var(--spend)', mark: 'dot' },
                    { key: 'sp', label: 'Ad spend', value: fmt.money(days[a].spend), muted: true },
                    { key: 'rev', label: 'AdMob revenue', value: fmt.money(days[a].revenue), muted: true },
                  ]
                : [{ key: 'none', label: 'No entry for this day', value: '—' }]
            }
          />
        ) : null}
      </div>
    </Panel>
  );
}
