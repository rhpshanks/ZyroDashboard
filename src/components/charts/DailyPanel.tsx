import { useMemo, useRef, useState } from 'react';
import { scaleBand, scaleLinear } from 'd3-scale';
import { area, curveMonotoneX, line } from 'd3-shape';
import type { Bucket, Gran } from '../../types';
import type { Fmt } from '../../lib/format';
import { pct } from '../../lib/format';
import { bucketLabel, roasOf } from '../../lib/metrics';
import type { Prefs } from '../../lib/prefs';
import { fmtDate } from '../../lib/date';
import { ChartTooltip, Icon, Panel, Segmented, Toggle, barPath, tickIndices, useKeyNav, useWidth, type TipRow } from '../ui';

type Series = 'spend' | 'revenue' | 'net';
const SERIES: { id: Series; label: string; color: string }[] = [
  { id: 'spend', label: 'Ad spend', color: 'var(--spend)' },
  { id: 'revenue', label: 'AdMob revenue', color: 'var(--revenue)' },
  { id: 'net', label: 'Net profit', color: 'var(--net)' },
];

const M = { top: 12, right: 14, bottom: 28, left: 54 };
const H = 310;

interface Pt {
  spend: number | null;
  revenue: number | null;
  net: number | null;
}

export function DailyPanel({
  buckets,
  gran,
  prefs,
  update,
  fmt,
  wide,
  onZoom,
  onPickDay,
}: {
  buckets: Bucket[];
  gran: Gran;
  prefs: Prefs['daily'];
  update: (p: Partial<Prefs['daily']>) => void;
  fmt: Fmt;
  wide: boolean;
  onZoom: (start: string, end: string) => void;
  onPickDay: (date: string) => void;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [table, setTable] = useState(false);
  const [brush, setBrush] = useState<{ a: number; b: number } | null>(null);
  const drag = useRef<{ x0: number; moved: boolean } | null>(null);
  const { mode, cumulative, show } = prefs;
  const avg = prefs.avg && gran === 'day' && !cumulative;
  const n = buckets.length;
  const hasData = buckets.some((b) => b.has);

  const pts: Pt[] = useMemo(() => {
    let s = 0;
    let r = 0;
    let started = false;
    return buckets.map((b) => {
      if (!cumulative) return b.has ? { spend: b.spend, revenue: b.revenue, net: b.net } : { spend: null, revenue: null, net: null };
      if (b.has) {
        started = true;
        s += b.spend;
        r += b.revenue;
      }
      return started ? { spend: s, revenue: r, net: r - s } : { spend: null, revenue: null, net: null };
    });
  }, [buckets, cumulative]);

  // Trailing 7-day average over tracked days (needs at least 3 of them).
  const ma = useMemo(() => {
    if (!avg) return null;
    return buckets.map((_, i) => {
      let s = 0;
      let r = 0;
      let c = 0;
      for (let j = Math.max(0, i - 6); j <= i; j++) {
        if (!buckets[j].has) continue;
        s += buckets[j].spend;
        r += buckets[j].revenue;
        c++;
      }
      return c >= 3 ? { spend: s / c, revenue: r / c } : null;
    });
  }, [buckets, avg]);

  const plotW = Math.max(10, width - M.left - M.right);
  const plotH = H - M.top - M.bottom;

  const x = useMemo(
    () =>
      scaleBand<number>()
        .domain(buckets.map((_, i) => i))
        .range([0, plotW])
        .paddingInner(mode === 'bars' ? 0.3 : 0)
        .paddingOuter(mode === 'bars' ? 0.15 : 0),
    [buckets, plotW, mode],
  );
  const bw = x.bandwidth();
  const cx = (i: number) => (x(i) ?? 0) + bw / 2;

  const y = useMemo(() => {
    const vals: number[] = [0];
    for (const p of pts) for (const s of SERIES) if (show[s.id] && p[s.id] !== null) vals.push(p[s.id] as number);
    if (ma) for (const m of ma) if (m) {
      if (show.spend) vals.push(m.spend);
      if (show.revenue) vals.push(m.revenue);
    }
    let lo = Math.min(...vals);
    let hi = Math.max(...vals);
    if (hi === lo) hi = lo + 1;
    return scaleLinear().domain([lo, hi]).range([plotH, 0]).nice(5);
  }, [pts, ma, show, plotH]);
  const y0 = y(0);

  const nav = useKeyNav(n, (i) => pick(i));
  const active = nav.active;

  function pick(i: number) {
    const b = buckets[i];
    if (!b) return;
    if (gran === 'day') {
      if (b.has) onPickDay(b.start);
    } else onZoom(b.start, b.end);
  }

  const idxAt = (px: number) => {
    if (!n) return 0;
    const i = Math.round((px - (x(0) ?? 0) - bw / 2) / x.step());
    return Math.max(0, Math.min(n - 1, i));
  };

  const lineFor = (key: Series) =>
    line<Pt>()
      .defined((p) => p[key] !== null)
      .x((_, i) => cx(i))
      .y((p) => y(p[key] as number))
      .curve(curveMonotoneX)(pts) ?? '';
  const areaFor = (key: 'spend' | 'revenue') =>
    area<Pt>()
      .defined((p) => p[key] !== null)
      .x((_, i) => cx(i))
      .y0(y0)
      .y1((p) => y(p[key] as number))
      .curve(curveMonotoneX)(pts) ?? '';
  const maLine = (key: 'spend' | 'revenue') =>
    ma
      ? line<{ spend: number; revenue: number } | null>()
          .defined((m) => m !== null)
          .x((_, i) => cx(i))
          .y((m) => y(m![key]))
          .curve(curveMonotoneX)(ma) ?? ''
      : '';

  const barSeries = SERIES.filter((s) => s.id !== 'net' && show[s.id]);
  const k = barSeries.length;
  const barW = k ? Math.min(24, Math.max(1, (bw - 2 * (k - 1)) / k)) : 0;
  const groupW = k * barW + (k - 1) * 2;
  const multiYear = n > 0 && buckets[0].start.slice(0, 4) !== buckets[n - 1].start.slice(0, 4);
  const ticks = tickIndices(n, plotW, gran === 'day' ? 66 : 58);
  const yTicks = y.ticks(5);
  const showDots = n <= 45;

  const tip = (() => {
    if (active === null || !buckets[active]) return null;
    const b = buckets[active];
    const p = pts[active];
    const title = bucketLabel(b, gran, 'title');
    if (p.spend === null) return { title, rows: [{ key: 'none', label: 'No entry for this period', value: '—' }] as TipRow[] };
    const rows: TipRow[] = [];
    const suffix = cumulative ? ' (running)' : '';
    rows.push({ key: 'revenue', label: `AdMob revenue${suffix}`, value: fmt.money(p.revenue!), color: 'var(--revenue)', mark: mode === 'bars' ? 'rect' : 'line', muted: !show.revenue });
    rows.push({ key: 'spend', label: `Ad spend${suffix}`, value: fmt.money(p.spend), color: 'var(--spend)', mark: mode === 'bars' ? 'rect' : 'line', muted: !show.spend });
    rows.push({ key: 'net', label: `Net profit${suffix}`, value: fmt.money(p.net!, { sign: true }), color: 'var(--net)', muted: !show.net });
    rows.push({ key: 'roas', label: 'ROAS', value: pct(roasOf(p.revenue!, p.spend)) });
    if (ma?.[active]) rows.push({ key: 'ma', label: '7-day avg revenue', value: fmt.money(ma[active]!.revenue), muted: true });
    return { title, rows };
  })();

  const onPointerDown = (e: React.PointerEvent<SVGRectElement>) => {
    const px = e.clientX - e.currentTarget.getBoundingClientRect().left;
    drag.current = { x0: px, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
    if (e.pointerType !== 'mouse') nav.setActive(idxAt(px));
  };
  const onPointerMove = (e: React.PointerEvent<SVGRectElement>) => {
    const px = e.clientX - e.currentTarget.getBoundingClientRect().left;
    nav.setActive(idxAt(px));
    const d = drag.current;
    if (d) {
      if (Math.abs(px - d.x0) > 6) d.moved = true;
      if (d.moved) setBrush({ a: Math.max(0, Math.min(d.x0, px)), b: Math.min(plotW, Math.max(d.x0, px)) });
    }
  };
  const onPointerUp = (e: React.PointerEvent<SVGRectElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const px = e.clientX - e.currentTarget.getBoundingClientRect().left;
    if (d.moved) {
      const i0 = idxAt(Math.min(d.x0, px));
      const i1 = idxAt(Math.max(d.x0, px));
      setBrush(null);
      if (i1 > i0) onZoom(buckets[i0].start, buckets[i1].end);
    } else if (e.pointerType === 'mouse') pick(idxAt(px));
  };

  const tools = (
    <>
      <Segmented
        label="Group by"
        size="sm"
        value={prefs.gran}
        onChange={(v) => update({ gran: v })}
        options={[
          { value: 'auto', label: 'Auto', title: 'Days up to 3 months, then weeks, then months' },
          { value: 'day', label: 'Day' },
          { value: 'week', label: 'Week' },
          { value: 'month', label: 'Month' },
        ]}
      />
      <Segmented
        label="Chart style"
        size="sm"
        value={mode}
        onChange={(v) => update({ mode: v })}
        options={[
          { value: 'bars', label: 'Bars' },
          { value: 'lines', label: 'Lines' },
          { value: 'area', label: 'Area' },
        ]}
      />
      <button type="button" className={`icon-btn ${table ? 'on' : ''}`} aria-pressed={table} onClick={() => setTable(!table)} title={table ? 'Show chart' : 'Show as table'}>
        <Icon name={table ? 'chart' : 'table'} />
      </button>
    </>
  );

  return (
    <Panel id="daily" title="Spend vs revenue" sub={gran === 'day' ? 'Drag across the chart to zoom in · click a day for details' : `Grouped by ${gran} · click a ${gran} to zoom in`} tools={tools} wide={wide}>
      <div className="legend-row">
        <div className="legend" role="group" aria-label="Series">
          {SERIES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`legend-item ${show[s.id] ? '' : 'off'}`}
              aria-pressed={show[s.id]}
              onClick={() => {
                const next = { ...show, [s.id]: !show[s.id] };
                if (next.spend || next.revenue || next.net) update({ show: next });
              }}
            >
              <span className={`key ${s.id === 'net' || mode !== 'bars' ? 'key-line' : 'key-rect'}`} style={{ background: s.color }} />
              {s.label}
            </button>
          ))}
        </div>
        <div className="legend-opts">
          <Toggle on={cumulative} onChange={(v) => update({ cumulative: v })} label="Running total" />
          <Toggle on={prefs.avg} onChange={(v) => update({ avg: v })} label="7-day avg" />
        </div>
      </div>

      {table ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{gran === 'day' ? 'Date' : gran === 'week' ? 'Week' : 'Month'}</th>
                <th className="num">Spend</th>
                <th className="num">Revenue</th>
                <th className="num">Net</th>
                <th className="num">ROAS</th>
              </tr>
            </thead>
            <tbody>
              {[...buckets].reverse().map((b) => (
                <tr key={b.key} className={b.has ? '' : 'empty'}>
                  <td>{bucketLabel(b, gran, 'title')}</td>
                  <td className="num">{b.has ? fmt.money(b.spend) : '—'}</td>
                  <td className="num">{b.has ? fmt.money(b.revenue) : '—'}</td>
                  <td className={`num ${b.net > 0 ? 'pos' : b.net < 0 ? 'neg' : ''}`}>{b.has ? fmt.money(b.net, { sign: true }) : '—'}</td>
                  <td className="num">{b.has ? pct(roasOf(b.revenue, b.spend)) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          className="chart"
          ref={ref}
          style={{ height: H }}
          tabIndex={0}
          role="application"
          aria-label="Spend and revenue chart. Use left and right arrow keys to move between periods, Enter to open."
          onKeyDown={nav.onKeyDown}
          onBlur={() => nav.setActive(null)}
        >
          {width > 0 && hasData ? (
            <svg width={width} height={H} className={`viz mode-${mode}`}>
              <g transform={`translate(${M.left},${M.top})`}>
                {yTicks.map((t) => (
                  <g key={t} transform={`translate(0,${y(t)})`}>
                    <line x2={plotW} className={t === 0 ? 'axis-line' : 'grid-line'} />
                    <text x={-10} dy="0.32em" className="tick" textAnchor="end">
                      {fmt.axis(t)}
                    </text>
                  </g>
                ))}
                {active !== null && mode === 'bars' ? <rect x={(x(active) ?? 0) - (x.step() - bw) / 2} width={x.step()} y={0} height={plotH} className="hover-band" /> : null}

                {mode === 'area'
                  ? barSeries.map((s) => <path key={`a-${s.id}`} d={areaFor(s.id as 'spend' | 'revenue')} className="area-fill" style={{ fill: s.color }} />)
                  : null}

                {mode === 'bars'
                  ? pts.map((p, i) => {
                      if (p.spend === null) return null;
                      const gx = (x(i) ?? 0) + (bw - groupW) / 2;
                      return (
                        <g key={i} className={active !== null && active !== i ? 'dim' : ''}>
                          {barSeries.map((s, j) => (
                            <path key={s.id} d={barPath(gx + j * (barW + 2), barW, y0, y(p[s.id] as number))} className="bar" style={{ fill: s.color }} />
                          ))}
                        </g>
                      );
                    })
                  : barSeries.map((s) => <path key={`l-${s.id}`} d={lineFor(s.id)} className="series-line" style={{ stroke: s.color }} />)}

                {avg && show.revenue ? <path d={maLine('revenue')} className="ma-line" style={{ stroke: 'var(--revenue)' }} /> : null}
                {avg && show.spend ? <path d={maLine('spend')} className="ma-line" style={{ stroke: 'var(--spend)' }} /> : null}

                {show.net ? (
                  <>
                    <path d={lineFor('net')} className="series-line net-line" />
                    {showDots && mode === 'bars'
                      ? pts.map((p, i) => (p.net === null ? null : <circle key={i} cx={cx(i)} cy={y(p.net)} r={3.5} className="net-dot" />))
                      : null}
                  </>
                ) : null}

                {active !== null && mode !== 'bars' ? (
                  <g>
                    <line x1={cx(active)} x2={cx(active)} y1={0} y2={plotH} className="crosshair" />
                    {SERIES.filter((s) => show[s.id] && pts[active][s.id] !== null).map((s) => (
                      <circle key={s.id} cx={cx(active)} cy={y(pts[active][s.id] as number)} r={4.5} className="hover-dot" style={{ fill: s.color }} />
                    ))}
                  </g>
                ) : null}

                {ticks.map((i) => {
                  const tx = cx(i);
                  const anchor = tx < 24 ? 'start' : tx > plotW - 24 ? 'end' : 'middle';
                  const b = buckets[i];
                  const label = gran === 'month' && multiYear ? fmtDate(b.start, 'monthYear') : bucketLabel(b, gran, 'tick');
                  return (
                    <text key={i} x={tx} y={plotH + 19} className="tick" textAnchor={anchor}>
                      {label}
                    </text>
                  );
                })}

                {brush ? <rect x={brush.a} width={brush.b - brush.a} y={0} height={plotH} className="brush" /> : null}
                <rect
                  className="hit"
                  width={plotW}
                  height={plotH}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerLeave={() => {
                    if (!drag.current) nav.setActive(null);
                  }}
                />
              </g>
            </svg>
          ) : null}
          {width > 0 && !hasData ? <div className="chart-empty">No entries in this range.</div> : null}
          {tip && active !== null ? (
            <ChartTooltip
              x={M.left + cx(active)}
              y={M.top + 4}
              width={width}
              title={tip.title}
              rows={tip.rows}
              hint={buckets[active].has ? (gran === 'day' ? 'Click for day details' : `Click to zoom into this ${gran}`) : undefined}
            />
          ) : null}
        </div>
      )}
    </Panel>
  );
}
