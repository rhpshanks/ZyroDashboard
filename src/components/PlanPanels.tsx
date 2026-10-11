import { useEffect, useMemo, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { line } from 'd3-shape';
import type { Fmt } from '../lib/format';
import { pct } from '../lib/format';
import type { Summary } from '../lib/metrics';
import { Panel, Segmented, useWidth } from './ui';

// ---- Monthly goals ------------------------------------------------------------------

function MoneyInput({ label, value, onCommit, fmt }: { label: string; value: number; onCommit: (v: number) => void; fmt: Fmt }) {
  const [text, setText] = useState(String(Math.round(value * 100) / 100));
  useEffect(() => setText(String(Math.round(value * 100) / 100)), [value]);
  const commit = () => {
    const v = Number(text.replace(/[^\d.]/g, ''));
    if (Number.isFinite(v) && v >= 0) onCommit(v);
    else setText(String(value));
  };
  return (
    <label className="money-input">
      <span>{label}</span>
      <span className="money-input-box">
        <span aria-hidden="true">{fmt.symbol.trim()}</span>
        <input inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && commit()} />
      </span>
    </label>
  );
}

export function GoalsPanel({
  monthLabel,
  month,
  dim,
  elapsed,
  goal,
  budget,
  onGoal,
  onBudget,
  fmt,
  wide,
}: {
  monthLabel: string;
  month: Summary;
  dim: number;
  elapsed: number;
  goal: number;
  budget: number;
  onGoal: (v: number) => void;
  onBudget: (v: number) => void;
  fmt: Fmt;
  wide: boolean;
}) {
  const projNet = month.tracked ? (month.net / month.tracked) * dim : null;
  const projSpend = month.tracked ? (month.spend / month.tracked) * dim : null;
  const goalFill = goal > 0 ? Math.max(0, Math.min(1, month.net / goal)) : 0;
  const projMark = goal > 0 && projNet !== null ? Math.max(0, Math.min(1, projNet / goal)) : null;
  const spendFill = budget > 0 ? Math.min(1, month.spend / budget) : 0;
  const pace = dim ? elapsed / dim : 0;
  const expected = budget * pace;
  const left = Math.max(0, budget - month.spend);
  const daysLeft = Math.max(0, dim - elapsed);

  let goalStatus = `No entries in ${monthLabel} yet.`;
  if (projNet !== null) {
    if (goal <= 0) goalStatus = 'Set a profit goal to track progress.';
    else if (month.net >= goal) goalStatus = 'Goal reached. Anything from here is extra.';
    else if (projNet >= goal) goalStatus = `On track: at this pace ${monthLabel} ends near ${fmt.money(projNet, { sign: true })}.`;
    else goalStatus = `At this pace ${monthLabel} ends near ${fmt.money(projNet, { sign: true })}, ${fmt.money(goal - projNet)} short.`;
  }

  let spendStatus = 'Set a monthly budget to see pacing.';
  if (budget > 0) {
    const diff = month.spend - expected;
    const tol = budget * 0.03;
    const paceText = Math.abs(diff) <= tol ? 'On pace' : diff > 0 ? `${fmt.money(diff)} ahead of pace` : `${fmt.money(-diff)} under pace`;
    if (month.spend > budget) spendStatus = `Over budget by ${fmt.money(month.spend - budget)}`;
    else spendStatus = daysLeft > 0 ? `${paceText} · ${fmt.money(left / daysLeft)}/day left for ${daysLeft} more ${daysLeft === 1 ? 'day' : 'days'}` : paceText;
    if (projSpend !== null && projSpend > budget * 1.03) spendStatus += ` · heading for ${fmt.money(projSpend)} by month end`;
  }

  return (
    <Panel id="goals" title="Monthly goals" sub={`${monthLabel} · day ${elapsed} of ${dim}`} wide={wide}>
      <div className="goals">
        <div className="goal">
          <div className="goal-head">
            <span className="goal-name">Profit goal</span>
            <MoneyInput label="Goal" value={goal} onCommit={onGoal} fmt={fmt} />
          </div>
          <div className="goal-figure">
            <b className={month.net < 0 ? 'neg' : ''}>{fmt.money(month.net, { sign: true })}</b>
            <span> of {fmt.money(goal)}</span>
            <span className="goal-pct">{goal > 0 ? pct(Math.max(0, month.net) / goal) : '—'}</span>
          </div>
          <div className="meter big meter-revenue" role="meter" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={Math.max(0, month.net)} aria-label="Profit toward goal">
            <div className="meter-fill" style={{ width: `${goalFill * 100}%` }} />
            {projMark !== null ? <div className="meter-mark" style={{ left: `${projMark * 100}%` }} title="Projected month end" /> : null}
          </div>
          <p className="goal-status">{goalStatus}</p>
        </div>
        <div className="goal">
          <div className="goal-head">
            <span className="goal-name">Spend budget</span>
            <MoneyInput label="Budget" value={budget} onCommit={onBudget} fmt={fmt} />
          </div>
          <div className="goal-figure">
            <b>{fmt.money(month.spend)}</b>
            <span> of {fmt.money(budget)}</span>
            <span className="goal-pct">{budget > 0 ? pct(month.spend / budget) : '—'}</span>
          </div>
          <div className="meter big meter-spend" role="meter" aria-valuemin={0} aria-valuemax={budget} aria-valuenow={month.spend} aria-label="Spend against budget">
            <div className="meter-fill" style={{ width: `${spendFill * 100}%` }} />
            <div className="meter-mark pace" style={{ left: `${pace * 100}%` }} title="Where spend should be today" />
          </div>
          <p className="goal-status">{spendStatus}</p>
        </div>
        <p className="fine">The tick on each bar marks the projected month end (profit) or where spend should be today (budget).</p>
      </div>
    </Panel>
  );
}

// ---- Scale simulator ---------------------------------------------------------------

export function SimulatorPanel({ sum, unit, fmt, wide }: { sum: Summary; unit: number; fmt: Fmt; wide: boolean }) {
  const placeholder = sum.spend <= 0 || sum.roas === null;
  const S0 = placeholder ? 10 * unit : sum.avgSpend;
  const r0 = placeholder ? 1 : (sum.roas as number);
  const [spend, setSpend] = useState(S0);
  const [decay, setDecay] = useState(0.25);
  const [horizon, setHorizon] = useState(30);
  useEffect(() => setSpend(S0), [S0]);

  const roasAt = (s: number) => (s <= 0 ? r0 : r0 * Math.pow(s / S0, -decay));
  const profitAt = (s: number) => s * roasAt(s) - s;
  const peak = decay > 0 && r0 * (1 - decay) > 0 ? S0 * Math.pow((1 - decay) * r0, 1 / decay) : null;
  const sMax = Math.max(S0 * 4, 50 * unit, peak && peak < S0 * 8 ? peak * 1.4 : 0);
  const step = unit === 1 ? 0.5 : 50;

  const [ref, width] = useWidth<HTMLDivElement>();
  const H = 210;
  const M = { top: 22, right: 18, bottom: 28, left: 56 };
  const plotW = Math.max(10, width - M.left - M.right);
  const plotH = H - M.top - M.bottom;
  const curve = useMemo(() => Array.from({ length: 81 }, (_, i) => (i / 80) * sMax).map((s) => ({ s, p: profitAt(s) })), [sMax, decay, r0, S0]);
  const x = scaleLinear().domain([0, sMax]).range([0, plotW]);
  const ps = curve.map((c) => c.p);
  const y = scaleLinear()
    .domain([Math.min(0, ...ps), Math.max(0, ...ps, 1e-9)])
    .range([plotH, 0])
    .nice(4);
  const d = line<{ s: number; p: number }>().x((c) => x(c.s)).y((c) => y(c.p))(curve) ?? '';

  const setFromPointer = (e: React.PointerEvent<SVGRectElement>) => {
    const px = e.clientX - e.currentTarget.getBoundingClientRect().left;
    const v = Math.max(0, Math.min(sMax, x.invert(px)));
    setSpend(Math.round(v / step) * step);
  };

  const dailyProfit = profitAt(spend);
  let insight: string;
  if (decay === 0) {
    insight = r0 > 1 ? 'With no decay, every extra dollar keeps the same ROAS, so profit grows without limit. Real campaigns rarely behave that way.' : 'At this ROAS every dollar of ad spend loses money.';
  } else if (peak !== null && peak > 0) {
    insight =
      peak < S0 * 0.97
        ? `Profit peaks near ${fmt.money(peak)}/day (${fmt.money(profitAt(peak), { sign: true })}/day). Your current ${fmt.money(S0)}/day is past that point.`
        : `Profit peaks near ${fmt.money(peak)}/day (${fmt.money(profitAt(peak), { sign: true })}/day). Past that, each extra dollar brings back less than a dollar.`;
  } else insight = 'At this ROAS every dollar of ad spend loses money.';

  return (
    <Panel
      id="simulator"
      title="Scale simulator"
      sub={placeholder ? 'Using placeholder numbers until this range has ad spend' : `Starting from your ${fmt.money(S0)}/day at ${pct(r0)} ROAS in this range`}
      wide={wide}
      tools={
        <Segmented
          label="Horizon"
          size="sm"
          value={horizon}
          onChange={setHorizon}
          options={[
            { value: 7, label: '7 days' },
            { value: 30, label: '30 days' },
            { value: 90, label: '90 days' },
          ]}
        />
      }
    >
      <div className="sim">
        <div className="sim-controls">
          <label className="slider">
            <span className="slider-head">
              <span>Daily spend</span>
              <b>{fmt.money(spend)}</b>
            </span>
            <input type="range" min={0} max={sMax} step={step} value={Math.min(spend, sMax)} onChange={(e) => setSpend(Number(e.target.value))} />
          </label>
          <label className="slider">
            <span className="slider-head">
              <span>ROAS drop-off as you scale</span>
              <b>{decay === 0 ? 'None' : decay < 0.2 ? 'Gentle' : decay < 0.4 ? 'Typical' : 'Steep'}</b>
            </span>
            <input type="range" min={0} max={0.6} step={0.05} value={decay} onChange={(e) => setDecay(Number(e.target.value))} />
          </label>
          <div className="sim-out">
            <div>
              <span>ROAS at this spend</span>
              <b>{pct(roasAt(spend))}</b>
            </div>
            <div>
              <span>Daily profit</span>
              <b className={dailyProfit >= 0 ? 'pos' : 'neg'}>{fmt.money(dailyProfit, { sign: true })}</b>
            </div>
            <div>
              <span>{horizon}-day spend</span>
              <b>{fmt.money(spend * horizon)}</b>
            </div>
            <div>
              <span>{horizon}-day profit</span>
              <b className={dailyProfit >= 0 ? 'pos' : 'neg'}>{fmt.money(dailyProfit * horizon, { sign: true })}</b>
            </div>
          </div>
          <p className="sim-insight">{insight}</p>
        </div>
        <div className="chart sim-chart" ref={ref} style={{ height: H }}>
          {width > 0 ? (
            <svg width={width} height={H} className="viz" role="img" aria-label={`Daily profit by daily spend. ${insight}`}>
              <g transform={`translate(${M.left},${M.top})`}>
                {y.ticks(4).map((t) => (
                  <g key={t} transform={`translate(0,${y(t)})`}>
                    <line x2={plotW} className={t === 0 ? 'axis-line' : 'grid-line'} />
                    <text x={-10} dy="0.32em" className="tick" textAnchor="end">
                      {fmt.axis(t)}
                    </text>
                  </g>
                ))}
                {x.ticks(5).map((t) => (
                  <text key={t} x={x(t)} y={plotH + 19} className="tick" textAnchor={x(t) < 20 ? 'start' : 'middle'}>
                    {fmt.axis(t)}
                  </text>
                ))}
                <text x={plotW} y={plotH + 19} className="tick" textAnchor="end" dy={0}>
                  /day
                </text>
                <path d={d} className="series-line net-line" />
                <g transform={`translate(${x(S0)},${y(profitAt(S0))})`}>
                  <circle r={4.5} className="sim-now" />
                  <text y={16} className="annot muted" textAnchor="middle">
                    Now
                  </text>
                </g>
                {peak !== null && peak <= sMax ? (
                  <g transform={`translate(${x(peak)},${y(profitAt(peak))})`}>
                    <circle r={5} className="sim-peak" />
                    <text y={-11} className="annot" textAnchor="middle">
                      Peak
                    </text>
                  </g>
                ) : null}
                <line x1={x(spend)} x2={x(spend)} y1={0} y2={plotH} className="crosshair" />
                <circle cx={x(spend)} cy={y(dailyProfit)} r={5.5} className="hover-dot" style={{ fill: 'var(--net)' }} />
                <rect
                  className="hit"
                  width={plotW}
                  height={plotH}
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setFromPointer(e);
                  }}
                  onPointerMove={(e) => e.buttons && setFromPointer(e)}
                />
              </g>
            </svg>
          ) : null}
        </div>
      </div>
      <p className="fine">
        Model: ROAS falls as spend rises, as ROAS × (new spend ÷ current spend)<sup>−drop-off</sup>. Drag on the curve to try a spend level. It's a planning guide, not a forecast.
      </p>
    </Panel>
  );
}
