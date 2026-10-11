import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Game } from '../types';
import type { Prefs } from '../lib/prefs';
import type { Range } from '../lib/metrics';
import { PRESETS } from '../lib/metrics';
import { diffDays, fmtDate, fmtRange, todayISO } from '../lib/date';
import { GameAvatar, Icon, Segmented } from './ui';

export function Header({
  lastDate,
  demo,
  theme,
  onTheme,
  onCustomize,
  playStoreUrl,
}: {
  lastDate: string | null;
  demo: boolean;
  theme: Prefs['theme'];
  onTheme: () => void;
  onCustomize: () => void;
  playStoreUrl: string;
}) {
  const stale = lastDate ? diffDays(lastDate, todayISO()) : 0;
  return (
    <header className="topbar">
      <a className="brand" href="/" aria-label="Zyro Ad Returns home">
        <img src="/brand/zyro-mark.png" alt="" width={44} height={44} />
        <span className="brand-text">
          <span className="wordmark">ZYRO</span>
          <span className="brand-sub">Ad returns</span>
        </span>
      </a>
      <div className="topbar-right">
        <span className={`status-chip ${demo ? 'demo' : stale > 1 ? 'stale' : ''}`}>
          <span className="status-dot" aria-hidden="true" />
          {demo
            ? 'Sample data'
            : lastDate
              ? `Data through ${fmtDate(lastDate, 'medium')}${stale > 1 ? ` · ${stale} days ago` : ''}`
              : 'No data'}
        </span>
        <a className="icon-btn" href={playStoreUrl} target="_blank" rel="noreferrer" title="Zyro on Google Play" aria-label="Zyro on Google Play">
          <Icon name="external" />
        </a>
        <button type="button" className="icon-btn" onClick={onTheme} title="Switch light and dark (T)" aria-label="Switch light and dark">
          <Icon name={theme === 'light' ? 'moon' : 'sun'} />
        </button>
        <button type="button" className="btn btn-primary" onClick={onCustomize} title="Customize (C)">
          <Icon name="gear" />
          <span className="hide-sm">Customize</span>
        </button>
      </div>
    </header>
  );
}

function Popover({ open, onClose, children, align = 'left' }: { open: boolean; onClose: () => void; children: ReactNode; align?: 'left' | 'right' }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.parentElement?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className={`popover popover-${align}`} ref={ref} role="dialog">
      {children}
    </div>
  );
}

export function FilterBar({
  prefs,
  update,
  range,
  games,
  bounds,
  hasUntagged,
}: {
  prefs: Prefs;
  update: (p: Partial<Prefs>) => void;
  range: Range;
  games: Game[];
  bounds: { min: string; max: string };
  hasUntagged: boolean;
}) {
  const [customOpen, setCustomOpen] = useState(false);
  const [gamesOpen, setGamesOpen] = useState(false);
  const [start, setStart] = useState(range.start);
  const [end, setEnd] = useState(range.end);
  useEffect(() => {
    setStart(range.start);
    setEnd(range.end);
  }, [range.start, range.end]);

  const sel = prefs.games;
  const toggleGame = (id: string) => update({ games: sel.includes(id) ? sel.filter((g) => g !== id) : [...sel, id] });
  const selGames = games.filter((g) => sel.includes(g.id));
  const isCustom = prefs.range.preset === 'custom';

  return (
    <div className="filterbar" role="toolbar" aria-label="Filters">
      <div className="filter-presets">
        <Segmented
          label="Date range"
          value={isCustom ? ('custom' as const) : prefs.range.preset}
          onChange={(v) => update({ range: { preset: v } })}
          options={PRESETS.map((p, i) => ({ value: p.id, label: p.label, title: `${p.long} (${i + 1})` }))}
        />
      </div>
      <div className="filter-group">
        <div className="pop-anchor">
          <button type="button" className={`filter-btn ${isCustom ? 'on' : ''}`} onClick={() => setCustomOpen(!customOpen)} aria-expanded={customOpen}>
            <Icon name="calendar" size={14} />
            {isCustom ? fmtRange(range.start, range.end) : 'Custom'}
          </button>
          {isCustom ? (
            <button type="button" className="filter-clear" onClick={() => update({ range: { preset: '30d' } })} aria-label="Clear custom range">
              <Icon name="close" size={12} />
            </button>
          ) : null}
          <Popover open={customOpen} onClose={() => setCustomOpen(false)}>
            <div className="pop-title">Custom range</div>
            <div className="date-pair">
              <label>
                <span>From</span>
                <input type="date" value={start} min={bounds.min} max={bounds.max} onChange={(e) => setStart(e.target.value)} />
              </label>
              <label>
                <span>To</span>
                <input type="date" value={end} min={bounds.min} max={bounds.max} onChange={(e) => setEnd(e.target.value)} />
              </label>
            </div>
            <div className="pop-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setCustomOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!start || !end}
                onClick={() => {
                  update({ range: { preset: 'custom', start, end } });
                  setCustomOpen(false);
                }}
              >
                Apply range
              </button>
            </div>
          </Popover>
        </div>

        <div className="pop-anchor">
          <button type="button" className={`filter-btn ${sel.length ? 'on' : ''}`} onClick={() => setGamesOpen(!gamesOpen)} aria-expanded={gamesOpen}>
            {selGames.length ? (
              <span className="avatar-stack">
                {selGames.slice(0, 3).map((g) => (
                  <GameAvatar key={g.id} game={g} size={18} />
                ))}
              </span>
            ) : null}
            {sel.length === 0 ? 'All games' : sel.length === 1 ? (selGames[0]?.short ?? 'Untagged') : `${sel.length} games`}
          </button>
          {sel.length ? (
            <button type="button" className="filter-clear" onClick={() => update({ games: [] })} aria-label="Show all games">
              <Icon name="close" size={12} />
            </button>
          ) : null}
          <Popover open={gamesOpen} onClose={() => setGamesOpen(false)} align="right">
            <div className="pop-title">Games</div>
            <ul className="game-picker">
              <li>
                <label>
                  <input type="checkbox" checked={sel.length === 0} onChange={() => update({ games: [] })} />
                  <span className="avatar avatar-fallback" style={{ width: 24, height: 24, fontSize: 10 }}>
                    All
                  </span>
                  <span>All games</span>
                </label>
              </li>
              {games.map((g) => (
                <li key={g.id}>
                  <label>
                    <input type="checkbox" checked={sel.includes(g.id)} onChange={() => toggleGame(g.id)} />
                    <GameAvatar game={g} size={24} />
                    <span>
                      {g.short}
                      <small>{g.genre}</small>
                    </span>
                  </label>
                </li>
              ))}
              {hasUntagged ? (
                <li>
                  <label>
                    <input type="checkbox" checked={sel.includes('__untagged')} onChange={() => toggleGame('__untagged')} />
                    <GameAvatar size={24} />
                    <span>
                      Untagged
                      <small>Entries without a game</small>
                    </span>
                  </label>
                </li>
              ) : null}
            </ul>
          </Popover>
        </div>

        <Segmented
          label="Currency"
          size="sm"
          value={prefs.currency}
          onChange={(v) => update({ currency: v })}
          options={[
            { value: 'USD', label: 'USD' },
            { value: 'PKR', label: 'PKR' },
          ]}
        />
      </div>
    </div>
  );
}
