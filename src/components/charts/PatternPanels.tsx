import { useMemo, useState } from 'react';
import { scaleBand, scaleLinear } from 'd3-scale';
import type { DayRow, Entry, Game } from '../../types';
import type { Fmt } from '../../lib/format';
import { num, pct } from '../../lib/format';
import { roasOf } from '../../lib/metrics';
import { WEEKDAYS, addDays, diffDays, fmtDate, startOfWeek, weekdayMon0 } from '../../lib/date';
import { ChartTooltip, GameAvatar, Panel, Segmented, barPath, useWidth, type TipRow } from '../ui';

// ---- Profit calendar -------------------------------------------------------------

const LEVELS = [0, 32, 55, 78, 100];

function cellFill(d: DayRow, maxAbs: number): string | undefined {
  if (!d.has) return undefined;
  if (d.net === 0 || maxAbs === 0) return 'var(--cell-zero)';
  const level = Math.max(1, Math.min(4, Math.ceil((Math.abs(d.net) / maxAbs) * 4)));
  const hue = d.net > 0 ? 'var(--revenue)' : 'var(--spend)';
  return `color-mix(in oklab, ${hue} ${LEVELS[level]}%, var(--cell-zero))`;
}

export function CalendarPanel({ days, fmt, wide, onPickDay }: { days: DayRow[]; fmt: Fmt; wide: boolean; onPickDay: (d: string) => void }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const n = days.length;
  const first = n ? startOfWeek(days[0].date) : '';
  const weeks = n ? Math.floor(diffDays(first, days[n - 1].date) / 7) + 1 : 0;
  const maxAbs = Math.max(0, ...days.filter((d) => d.has).map((d) => Math.abs(d.net)));
  // Short ranges read best as a month grid (weeks down, weekdays across); long ranges as a year strip.
  const month = weeks <= 8;

  const gap = month ? 4 : 3;
  const LABEL_W = month ? 52 : 30;
  const HEAD_H = month ? 22 : 18;
  const stripCell = weeks ? Math.max(9, Math.min(28, Math.floor((width - LABEL_W) / weeks) - gap)) : 12;
  const cw = month ? Math.max(24, Math.min(84, Math.floor((width - LABEL_W) / 7) - gap)) : stripCell;
  const ch = month ? Math.max(30, Math.min(46, Math.round(cw * 0.62))) : cw;
  const cols = month ? 7 : weeks;
  const rows = month ? weeks : 7;
  const svgW = LABEL_W + cols * (cw + gap);
  const svgH = HEAD_H + rows * (ch + gap);
  const showVals = month && cw >= 50;

  const pos = (i: number) => {
    const d = days[i].date;
    const week = Math.floor(diffDays(first, d) / 7);
    const wd = weekdayMon0(d);
    const col = month ? wd : week;
    const row = month ? week : wd;
    return { x: LABEL_W + col * (cw + gap), y: HEAD_H + row * (ch + gap) };
  };

  const months: { x: number; label: string }[] = [];
  if (!month) {
    days.forEach((d, i) => {
      if (i === 0 || d.date.endsWith('-01')) {
        const x = LABEL_W + Math.floor(diffDays(first, d.date) / 7) * (cw + gap);
        if (!months.length || x - months[months.length - 1].x > 34) months.push({ x, label: fmtDate(d.date, 'month') });
      }
    });
  }

  const profit = days.filter((d) => d.has && d.net > 0).length;
  const loss = days.filter((d) => d.has && d.net < 0).length;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!n) return;
    const step: Record<string, number> = month
      ? { ArrowUp: -7, ArrowDown: 7, ArrowLeft: -1, ArrowRight: 1 }
      : { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 };
    if (e.key in step) {
      e.preventDefault();
      setActive((a) => Math.max(0, Math.min(n - 1, (a ?? n - 1) + step[e.key])));
    } else if (e.key === 'Enter' && active !== null && days[active].has) onPickDay(days[active].date);
    else if (e.key === 'Escape') setActive(null);
  };

  const a = active !== null ? days[active] : null;
  const ap = active !== null ? pos(active) : null;

  return (
    <Panel
      id="calendar"
      title="Profit calendar"
      sub={`${profit} profit ${profit === 1 ? 'day' : 'days'} · ${loss} loss ${loss === 1 ? 'day' : 'days'} · click a day for details`}
      wide={wide}
    >
      <div
        className="chart calendar"
        ref={ref}
        tabIndex={0}
        role="application"
        aria-label="Profit calendar. Arrow keys move between days, Enter opens a day."
        onKeyDown={onKeyDown}
        onBlur={() => setActive(null)}
      >
        {width > 0 && n ? (
          <div className="cal-scroll">
            <svg width={svgW} height={svgH} className="viz">
              {month
                ? WEEKDAYS.map((w, c) => (
                    <text key={w} x={LABEL_W + c * (cw + gap) + cw / 2} y={12} className="tick" textAnchor="middle">
                      {w}
                    </text>
                  ))
                : months.map((m) => (
                    <text key={m.x} x={m.x} y={11} className="tick">
                      {m.label}
                    </text>
                  ))}
              {month
                ? Array.from({ length: weeks }, (_, r) => (
                    <text key={r} x={0} y={HEAD_H + r * (ch + gap) + ch / 2} dy="0.32em" className="tick">
                      {fmtDate(addDays(first, r * 7), 'short')}
                    </text>
                  ))
                : [0, 2, 4].map((r) => (
                    <text key={r} x={0} y={HEAD_H + r * (ch + gap) + ch / 2} dy="0.32em" className="tick">
                      {WEEKDAYS[r]}
                    </text>
                  ))}
              {days.map((d, i) => {
                const p = pos(i);
                const fill = cellFill(d, maxAbs);
                const strong = d.has && maxAbs > 0 && Math.abs(d.net) / maxAbs > 0.5;
                return (
                  <g
                    key={d.date}
                    className="cal-day"
                    onPointerEnter={() => setActive(i)}
                    onPointerLeave={() => setActive((x) => (x === i ? null : x))}
                    onClick={() => d.has && onPickDay(d.date)}
                  >
                    <rect
                      x={p.x}
                      y={p.y}
                      width={cw}
                      height={ch}
                      rx={Math.min(month ? 6 : 4, cw / 4)}
                      className={`cal-cell ${fill ? '' : 'empty'} ${active === i ? 'on' : ''}`}
                      style={fill ? { fill } : undefined}
                    />
                    {month ? (
                      <text x={p.x + 6} y={p.y + 13} className={`cal-daynum ${strong ? 'strong' : ''}`}>
                        {Number(d.date.slice(8))}
                      </text>
                    ) : null}
                    {showVals && d.has ? (
                      <text x={p.x + 6} y={p.y + ch - 7} className={`cal-val ${strong ? 'strong' : ''}`}>
                        {fmt.short(d.net, true)}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </svg>
          </div>
        ) : null}
        {a && ap ? (
          <ChartTooltip
            x={Math.min(ap.x + cw, width)}
            y={ap.y + ch + 6}
            width={width}
            title={fmtDate(a.date, 'long')}
            rows={
              a.has
                ? [
                    { key: 'net', label: 'Net profit', value: fmt.money(a.net, { sign: true }), color: a.net >= 0 ? 'var(--revenue)' : 'var(--spend)', mark: 'rect' },
                    { key: 'sp', label: 'Ad spend', value: fmt.money(a.spend), muted: true },
                    { key: 'rev', label: 'AdMob revenue', value: fmt.money(a.revenue), muted: true },
                    { key: 'roas', label: 'ROAS', value: pct(roasOf(a.revenue, a.spend)), muted: true },
                  ]
                : [{ key: 'none', label: 'No entry for this day', value: '—' }]
            }
          />
        ) : null}
        <div className="scale-legend" aria-hidden="true">
          <span>Loss</span>
          {[4, 3, 2, 1].map((l) => (
            <i key={`l${l}`} style={{ background: `color-mix(in oklab, var(--spend) ${LEVELS[l]}%, var(--cell-zero))` }} />
          ))}
          <i style={{ background: 'var(--cell-zero)' }} />
          {[1, 2, 3, 4].map((l) => (
            <i key={`p${l}`} style={{ background: `color-mix(in oklab, var(--revenue) ${LEVELS[l]}%, var(--cell-zero))` }} />
          ))}
          <span>Profit</span>
          <i className="hollow" />
          <span>No entry</span>
        </div>
      </div>
    </Panel>
  );
}

// ---- Day-of-week pattern ---------------------------------------------------------

type WeekMetric = 'net' | 'roas' | 'spend' | 'revenue';

export function WeekdayPanel({
  days,
  metric,
  setMetric,
  fmt,
  wide,
}: {
  days: DayRow[];
  metric: WeekMetric;
  setMetric: (m: WeekMetric) => void;
  fmt: Fmt;
  wide: boolean;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const H = 230;
  const M = { top: 22, right: 10, bottom: 26, left: 50 };
  const plotW = Math.max(10, width - M.left - M.right);
  const plotH = H - M.top - M.bottom;

  const stats = useMemo(
    () =>
      WEEKDAYS.map((_, wd) => {
        const list = days.filter((d) => d.has && weekdayMon0(d.date) === wd);
        const spend = list.reduce((s, d) => s + d.spend, 0);
        const revenue = list.reduce((s, d) => s + d.revenue, 0);
        const c = list.length;
        return { wd, count: c, spend: c ? spend / c : 0, revenue: c ? revenue / c : 0, net: c ? (revenue - spend) / c : 0, roas: roasOf(revenue, spend) };
      }),
    [days],
  );
  const val = (s: (typeof stats)[number]) => (metric === 'roas' ? (s.roas ?? 0) : s[metric]);
  const withData = stats.filter((s) => s.count > 0);
  const vals = withData.map(val);
  const lo = Math.min(0, ...vals);
  const hi = Math.max(metric === 'roas' ? 1.2 : 0, ...vals, lo + 1e-9);
  const y = scaleLinear().domain([lo, hi]).range([plotH, 0]).nice(4);
  const x = scaleBand<number>().domain(WEEKDAYS.map((_, i) => i)).range([0, plotW]).paddingInner(0.3).paddingOuter(0.1);
  const bw = Math.min(24, x.bandwidth());
  const y0 = y(0);
  const fmtV = (v: number) => (metric === 'roas' ? pct(v) : metric === 'net' ? fmt.money(v, { sign: true }) : fmt.money(v));
  const color = (v: number) =>
    metric === 'net' ? (v >= 0 ? 'var(--revenue)' : 'var(--spend)') : metric === 'spend' ? 'var(--spend)' : metric === 'revenue' ? 'var(--revenue)' : 'var(--net)';
  const best = withData.length ? withData.reduce((m, s) => (val(s) > val(m) ? s : m)) : null;
  const worst = withData.length > 1 ? withData.reduce((m, s) => (val(s) < val(m) ? s : m)) : null;
  const metricName = { net: 'average profit', roas: 'ROAS', spend: 'average spend', revenue: 'average revenue' }[metric];

  return (
    <Panel
      id="weekday"
      title="Day-of-week pattern"
      sub={best ? `${WEEKDAYS[best.wd]} has the highest ${metricName} (${fmtV(val(best))})` : 'Needs a few tracked days'}
      wide={wide}
      tools={
        <Segmented
          label="Metric"
          size="sm"
          value={metric}
          onChange={setMetric}
          options={[
            { value: 'net', label: 'Profit' },
            { value: 'roas', label: 'ROAS' },
            { value: 'revenue', label: 'Revenue' },
            { value: 'spend', label: 'Spend' },
          ]}
        />
      }
    >
      <div className="chart" ref={ref} style={{ height: H }}>
        {width > 0 && withData.length ? (
          <svg width={width} height={H} className="viz" role="img" aria-label={`Average by weekday: ${withData.map((s) => `${WEEKDAYS[s.wd]} ${fmtV(val(s))}`).join(', ')}`}>
            <g transform={`translate(${M.left},${M.top})`}>
              {y.ticks(4).map((t) => (
                <g key={t} transform={`translate(0,${y(t)})`}>
                  <line x2={plotW} className={t === 0 ? 'axis-line' : 'grid-line'} />
                  <text x={-10} dy="0.32em" className="tick" textAnchor="end">
                    {metric === 'roas' ? pct(t) : fmt.axis(t)}
                  </text>
                </g>
              ))}
              {metric === 'roas' ? <line x2={plotW} y1={y(1)} y2={y(1)} className="ref-line" /> : null}
              {stats.map((s) => {
                const v = val(s);
                const bx = (x(s.wd) ?? 0) + (x.bandwidth() - bw) / 2;
                const labelled = s.count > 0 && (s === best || s === worst);
                return (
                  <g key={s.wd} onPointerEnter={() => setActive(s.wd)} onPointerLeave={() => setActive(null)}>
                    <rect x={x(s.wd)} y={0} width={x.bandwidth()} height={plotH} className={`hit-col ${active === s.wd ? 'on' : ''}`} />
                    {s.count > 0 ? <path d={barPath(bx, bw, y0, y(v))} className="bar" style={{ fill: color(v) }} /> : null}
                    {labelled ? (
                      <text x={bx + bw / 2} y={v >= 0 ? y(v) - 7 : y(v) + 14} className="bar-label" textAnchor="middle">
                        {fmtV(v)}
                      </text>
                    ) : null}
                    <text x={bx + bw / 2} y={plotH + 18} className="tick" textAnchor="middle">
                      {WEEKDAYS[s.wd]}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        ) : null}
        {width > 0 && !withData.length ? <div className="chart-empty">No entries in this range.</div> : null}
        {active !== null ? (
          <ChartTooltip
            x={M.left + (x(active) ?? 0) + x.bandwidth() / 2}
            y={M.top}
            width={width}
            title={`${WEEKDAYS[active]} · ${stats[active].count} tracked`}
            rows={
              stats[active].count
                ? ([
                    { key: 'net', label: 'Avg profit', value: fmt.money(stats[active].net, { sign: true }), color: 'var(--net)', muted: metric !== 'net' },
                    { key: 'rev', label: 'Avg revenue', value: fmt.money(stats[active].revenue), color: 'var(--revenue)', mark: 'rect', muted: metric !== 'revenue' },
                    { key: 'sp', label: 'Avg spend', value: fmt.money(stats[active].spend), color: 'var(--spend)', mark: 'rect', muted: metric !== 'spend' },
                    { key: 'roas', label: 'ROAS', value: pct(stats[active].roas), muted: metric !== 'roas' },
                  ] as TipRow[])
                : [{ key: 'none', label: 'No tracked days', value: '—' }]
            }
          />
        ) : null}
      </div>
    </Panel>
  );
}

// ---- By game ------------------------------------------------------------------------

export function GamesPanel({
  entries,
  games,
  selected,
  onToggle,
  fmt,
  wide,
  playStoreUrl,
}: {
  entries: Entry[];
  games: Game[];
  selected: string[];
  onToggle: (id: string) => void;
  fmt: Fmt;
  wide: boolean;
  playStoreUrl: string;
}) {
  const rows = useMemo(() => {
    const map = new Map<string, { id: string; spend: number; revenue: number; installs: number; days: Set<string> }>();
    for (const e of entries) {
      const id = e.game ?? '__untagged';
      const r = map.get(id) ?? { id, spend: 0, revenue: 0, installs: 0, days: new Set<string>() };
      r.spend += e.spend;
      r.revenue += e.revenue;
      r.installs += e.installs ?? 0;
      r.days.add(e.date);
      map.set(id, r);
    }
    return [...map.values()].map((r) => ({ ...r, net: r.revenue - r.spend, roas: roasOf(r.revenue, r.spend) })).sort((a, b) => b.net - a.net);
  }, [entries]);
  const max = Math.max(1e-9, ...rows.flatMap((r) => [r.spend, r.revenue]));
  const tagged = rows.some((r) => r.id !== '__untagged');
  const byId = new Map(games.map((g) => [g.id, g]));

  return (
    <Panel id="games" title="By game" sub={tagged ? 'Click a title to filter the whole dashboard' : 'Entries are not tagged with a game yet'} wide={wide}>
      {tagged ? (
        <ul className="game-rows">
          {rows.map((r) => {
            const g = byId.get(r.id);
            const isSel = selected.includes(r.id);
            return (
              <li key={r.id}>
                <button type="button" className={`game-row ${isSel ? 'on' : ''}`} onClick={() => onToggle(r.id)} aria-pressed={isSel}>
                  <GameAvatar game={g} size={34} />
                  <span className="game-name">
                    <b>{g?.short ?? 'Untagged'}</b>
                    <small>
                      {g?.genre ?? 'No game set'} · {r.days.size} {r.days.size === 1 ? 'day' : 'days'}
                      {r.installs ? ` · ${num(r.installs)} installs` : ''}
                    </small>
                  </span>
                  <span className="game-bars" aria-hidden="true">
                    <span className="gbar" style={{ width: `${(r.spend / max) * 100}%`, background: 'var(--spend)' }} />
                    <span className="gbar" style={{ width: `${(r.revenue / max) * 100}%`, background: 'var(--revenue)' }} />
                  </span>
                  <span className="game-figs">
                    <b className={r.net > 0 ? 'pos' : r.net < 0 ? 'neg' : ''}>{fmt.money(r.net, { sign: true })}</b>
                    <small>
                      {fmt.money(r.spend, { compact: true })} → {fmt.money(r.revenue, { compact: true })} · ROAS {pct(r.roas)}
                    </small>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="catalog">
          <p>Tell Claude which game each day's spend was for, and every title gets its own row here with spend, revenue and ROAS.</p>
          <ul>
            {games.map((g) => (
              <li key={g.id}>
                <GameAvatar game={g} size={30} />
                <span>
                  <b>{g.short}</b>
                  <small>{g.genre}</small>
                </span>
              </li>
            ))}
          </ul>
          <a href={playStoreUrl} target="_blank" rel="noreferrer" className="text-link">
            Zyro on Google Play
          </a>
        </div>
      )}
      {tagged ? (
        <div className="legend legend-static" aria-hidden="true">
          <span className="legend-item">
            <span className="key key-rect" style={{ background: 'var(--spend)' }} />
            Ad spend
          </span>
          <span className="legend-item">
            <span className="key key-rect" style={{ background: 'var(--revenue)' }} />
            AdMob revenue
          </span>
        </div>
      ) : null}
    </Panel>
  );
}

