import { useEffect, useRef } from 'react';
import type { DayRow, Game } from '../types';
import type { Fmt } from '../lib/format';
import { num, ordinal, pct, signedPct } from '../lib/format';
import type { Summary } from '../lib/metrics';
import { roasOf } from '../lib/metrics';
import { fmtDate } from '../lib/date';
import { GameAvatar, Icon } from './ui';

export function DayDrawer({
  day,
  days,
  sum,
  games,
  fmt,
  onClose,
  onNav,
}: {
  day: DayRow;
  days: DayRow[];
  sum: Summary;
  games: Game[];
  fmt: Fmt;
  onClose: () => void;
  onNav: (date: string) => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => closeRef.current?.focus(), []);
  const tracked = days.filter((d) => d.has);
  const idx = tracked.findIndex((d) => d.date === day.date);
  const prev = idx > 0 ? tracked[idx - 1] : undefined;
  const next = idx >= 0 && idx < tracked.length - 1 ? tracked[idx + 1] : undefined;
  const rank = [...tracked].sort((a, b) => b.net - a.net).findIndex((d) => d.date === day.date) + 1;
  const byId = new Map(games.map((g) => [g.id, g]));
  const roas = roasOf(day.revenue, day.spend);
  const vsAvg = (v: number, avg: number) => (avg ? (v - avg) / Math.abs(avg) : null);
  const tone = day.net > 0 ? 'pos' : day.net < 0 ? 'neg' : '';

  return (
    <div className="drawer-scrim" onClick={onClose}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="day-title" onClick={(e) => e.stopPropagation()}>
        <header className="drawer-head">
          <div>
            <div className="eyebrow">Day details</div>
            <h2 id="day-title">{fmtDate(day.date, 'full')}</h2>
          </div>
          <div className="drawer-nav">
            <button type="button" className="icon-btn" disabled={!prev} onClick={() => prev && onNav(prev.date)} aria-label="Previous tracked day">
              <Icon name="left" />
            </button>
            <button type="button" className="icon-btn" disabled={!next} onClick={() => next && onNav(next.date)} aria-label="Next tracked day">
              <Icon name="right" />
            </button>
            <button type="button" className="icon-btn" ref={closeRef} onClick={onClose} aria-label="Close">
              <Icon name="close" />
            </button>
          </div>
        </header>

        {!day.has ? (
          <p className="drawer-empty">No entry for this day.</p>
        ) : (
          <>
            <div className={`drawer-figure ${tone}`}>{fmt.money(day.net, { sign: true })}</div>
            <p className="drawer-rank">
              {rank > 0 ? `${ordinal(rank)} best of ${tracked.length} tracked ${tracked.length === 1 ? 'day' : 'days'} in this range` : ''}
            </p>
            <dl className="drawer-stats">
              <div>
                <dt>
                  <span className="key key-rect" style={{ background: 'var(--spend)' }} /> Ad spend
                </dt>
                <dd>{fmt.money(day.spend)}</dd>
                <dd className="vs">{signedPct(vsAvg(day.spend, sum.avgSpend))} vs avg</dd>
              </div>
              <div>
                <dt>
                  <span className="key key-rect" style={{ background: 'var(--revenue)' }} /> AdMob revenue
                </dt>
                <dd>{fmt.money(day.revenue)}</dd>
                <dd className="vs">{signedPct(vsAvg(day.revenue, sum.avgRevenue))} vs avg</dd>
              </div>
              <div>
                <dt>ROAS</dt>
                <dd>{pct(roas)}</dd>
                <dd className="vs">range {pct(sum.roas)}</dd>
              </div>
              {day.hasInstalls ? (
                <div>
                  <dt>Installs</dt>
                  <dd>{num(day.installs)}</dd>
                  <dd className="vs">CPI {day.installs ? fmt.money(day.spend / day.installs) : '—'}</dd>
                </div>
              ) : null}
            </dl>

            {day.entries.length > 1 || day.entries[0]?.game ? (
              <section className="drawer-section">
                <h3>By game</h3>
                <ul className="drawer-games">
                  {day.entries.map((e, i) => {
                    const g = e.game ? byId.get(e.game) : undefined;
                    const n = e.revenue - e.spend;
                    return (
                      <li key={i}>
                        <GameAvatar game={g} size={28} />
                        <span className="dg-name">
                          <b>{g?.short ?? 'Untagged'}</b>
                          <small>
                            {fmt.money(e.spend)} → {fmt.money(e.revenue)} · ROAS {pct(roasOf(e.revenue, e.spend))}
                          </small>
                        </span>
                        <b className={n > 0 ? 'pos' : n < 0 ? 'neg' : ''}>{fmt.money(n, { sign: true })}</b>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}

            {day.entries.some((e) => e.note) ? (
              <section className="drawer-section">
                <h3>Notes</h3>
                <ul className="drawer-notes">
                  {day.entries
                    .filter((e) => e.note)
                    .map((e, i) => (
                      <li key={i}>
                        {e.game ? <b>{byId.get(e.game)?.short}: </b> : null}
                        {e.note}
                      </li>
                    ))}
                </ul>
              </section>
            ) : null}
          </>
        )}
      </aside>
    </div>
  );
}
