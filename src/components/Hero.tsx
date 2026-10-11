import type { Fmt } from '../lib/format';
import { pct } from '../lib/format';
import type { Range, Summary } from '../lib/metrics';
import { fmtRange } from '../lib/date';
import { Delta } from './Kpis';

function ReturnSentence({ sum, fmt }: { sum: Summary; fmt: Fmt }) {
  if (sum.tracked === 0) return <p className="hero-sentence">No entries in this range yet.</p>;
  if (sum.spend === 0) {
    return (
      <p className="hero-sentence">
        No ad spend in this range, so all <b>{fmt.money(sum.revenue)}</b> of AdMob revenue is profit.
      </p>
    );
  }
  const unit = fmt.currency === 'PKR' ? 100 : 1;
  const back = (sum.roas ?? 0) * unit;
  const per = (v: number) => (fmt.currency === 'PKR' ? `${fmt.symbol}${Math.round(v)}` : `$${v.toFixed(2)}`);
  const base = fmt.currency === 'PKR' ? `${fmt.symbol}100` : '$1';
  return (
    <p className="hero-sentence">
      Every <b>{base}</b> on Google Ads brought back <b className="ret">{per(back)}</b> in AdMob revenue
      {back < unit ? <>, {per(unit - back)} short of break-even.</> : '.'}
    </p>
  );
}

/** The signature: spend and revenue as two brand "blades" on one scale, with the gap read as profit or shortfall. */
function Blades({ sum, fmt }: { sum: Summary; fmt: Fmt }) {
  const max = Math.max(sum.spend, sum.revenue);
  if (max <= 0) return <div className="blades blades-empty">Add a day's numbers to see spend against revenue.</div>;
  const s = (sum.spend / max) * 100;
  const r = (sum.revenue / max) * 100;
  const profit = sum.revenue >= sum.spend;
  const lo = Math.min(s, r);
  const hi = Math.max(s, r);
  const labelRight = (lo + hi) / 2 > 50;
  return (
    <div
      className="blades"
      role="img"
      aria-label={`Ad spend ${fmt.money(sum.spend)}, AdMob revenue ${fmt.money(sum.revenue)}, net ${fmt.money(sum.net, { sign: true })}, ROAS ${pct(sum.roas)}`}
    >
      <div className="blade-row">
        <div className="blade-head">
          <span className="key key-rect" style={{ background: 'var(--spend)' }} />
          <span className="blade-name">Ad spend</span>
          <span className="blade-val">{fmt.money(sum.spend)}</span>
        </div>
        <div className="blade-track">
          <div className="blade-grow" style={{ width: `${s}%` }}>
            <div className="blade blade-spend" />
          </div>
          <div className="be-tick" style={{ left: `${s}%` }} />
        </div>
      </div>
      <div className="blade-row">
        <div className="blade-head">
          <span className="key key-rect" style={{ background: 'var(--revenue)' }} />
          <span className="blade-name">AdMob revenue</span>
          <span className="blade-val">{fmt.money(sum.revenue)}</span>
        </div>
        <div className="blade-track">
          <div className="blade-grow" style={{ width: `${r}%` }}>
            <div className="blade blade-revenue">{profit && r > 0 ? <div className="blade-over" style={{ left: `${(s / r) * 100}%` }} /> : null}</div>
          </div>
          {!profit ? <div className="blade-short" style={{ left: `${r}%`, width: `${s - r}%` }} /> : null}
          <div className="be-tick" style={{ left: `${s}%` }} />
        </div>
      </div>
      <div className="blade-gap">
        {hi - lo > 0.4 ? <div className={`gap-bracket ${profit ? 'pos' : 'neg'}`} style={{ left: `${lo}%`, width: `${hi - lo}%` }} /> : null}
        <div className={`gap-label ${profit ? 'pos' : 'neg'}`} style={labelRight ? { right: `${100 - hi}%` } : { left: `${lo}%` }}>
          <b>{profit ? `${fmt.money(sum.net, { sign: true })} profit` : `${fmt.money(-sum.net)} to break even`}</b>
          <span>ROAS {pct(sum.roas)}</span>
        </div>
      </div>
      <p className="blade-caption">The tick marks break-even, where revenue equals spend.</p>
    </div>
  );
}

export function Hero({
  sum,
  prevSum,
  range,
  fmt,
}: {
  sum: Summary;
  prevSum: Summary;
  range: Range;
  fmt: Fmt;
}) {
  const tone = sum.net > 0 ? 'pos' : sum.net < 0 ? 'neg' : '';
  return (
    <section className="panel wide hero" aria-labelledby="hero-title" data-panel="hero">
      <div className="hero-left">
        <div className="eyebrow">
          {range.label} · {fmtRange(range.start, range.end)}
        </div>
        <div className="hero-label-row">
          <h2 id="hero-title" className="hero-label">
            Net profit
          </h2>
          {sum.tracked ? <span className={`tone-tag ${tone || 'flat'}`}>{sum.net > 0 ? 'In profit' : sum.net < 0 ? 'In the red' : 'Break-even'}</span> : null}
        </div>
        <div className={`hero-figure ${tone}`}>{fmt.money(sum.net, { sign: true })}</div>
        <Delta
          value={prevSum.tracked ? sum.net - prevSum.net : null}
          text={prevSum.tracked ? fmt.money(sum.net - prevSum.net, { sign: true }) : undefined}
          suffix={`vs previous ${range.days} days`}
          good="up"
        />
        <ReturnSentence sum={sum} fmt={fmt} />
      </div>
      <div className="hero-right">
        <Blades sum={sum} fmt={fmt} />
      </div>
    </section>
  );
}
