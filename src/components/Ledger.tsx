import { useMemo, useState } from 'react';
import type { Entry, Game } from '../types';
import type { Fmt } from '../lib/format';
import { num, pct } from '../lib/format';
import { roasOf } from '../lib/metrics';
import { fmtDate } from '../lib/date';
import { GameAvatar, Icon, Panel, Toggle } from './ui';

interface Row {
  key: string;
  date: string;
  game?: string;
  gameCount: number;
  spend: number;
  revenue: number;
  net: number;
  roas: number | null;
  installs: number | null;
  cpi: number | null;
  note: string;
}

type SortKey = 'date' | 'game' | 'spend' | 'revenue' | 'net' | 'roas' | 'installs' | 'cpi';

const COLS: { key: SortKey; label: string; num?: boolean }[] = [
  { key: 'date', label: 'Date' },
  { key: 'game', label: 'Game' },
  { key: 'spend', label: 'Spend', num: true },
  { key: 'revenue', label: 'Revenue', num: true },
  { key: 'net', label: 'Net', num: true },
  { key: 'roas', label: 'ROAS', num: true },
  { key: 'installs', label: 'Installs', num: true },
  { key: 'cpi', label: 'CPI', num: true },
];

const PAGE = 20;

function toRow(list: Entry[], key: string): Row {
  const spend = list.reduce((s, e) => s + e.spend, 0);
  const revenue = list.reduce((s, e) => s + e.revenue, 0);
  const withInstalls = list.filter((e) => e.installs !== undefined);
  const installs = withInstalls.length ? withInstalls.reduce((s, e) => s + (e.installs ?? 0), 0) : null;
  const installSpend = withInstalls.reduce((s, e) => s + e.spend, 0);
  const games = [...new Set(list.map((e) => e.game ?? ''))];
  return {
    key,
    date: list[0].date,
    game: games.length === 1 ? list[0].game : undefined,
    gameCount: games.length,
    spend,
    revenue,
    net: revenue - spend,
    roas: roasOf(revenue, spend),
    installs,
    cpi: installs ? installSpend / installs : null,
    note: list.map((e) => e.note).filter(Boolean).join(' · '),
  };
}

export function Ledger({
  entries,
  games,
  fmt,
  onPickDay,
  fileLabel,
  wide,
}: {
  entries: Entry[];
  games: Game[];
  fmt: Fmt;
  onPickDay: (d: string) => void;
  fileLabel: string;
  wide: boolean;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'date', dir: -1 });
  const [query, setQuery] = useState('');
  const [grouped, setGrouped] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const byId = useMemo(() => new Map(games.map((g) => [g.id, g])), [games]);
  const gameName = (r: Row) => (r.gameCount > 1 ? `${r.gameCount} games` : r.game ? (byId.get(r.game)?.short ?? r.game) : 'Untagged');

  const rows = useMemo(() => {
    let list: Row[];
    if (grouped) {
      const map = new Map<string, Entry[]>();
      for (const e of entries) map.set(e.date, [...(map.get(e.date) ?? []), e]);
      list = [...map.entries()].map(([d, l]) => toRow(l, d));
    } else list = entries.map((e, i) => toRow([e], `${e.date}-${e.game ?? ''}-${i}`));
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((r) => [r.date, fmtDate(r.date, 'long'), gameName(r), r.note].join(' ').toLowerCase().includes(q));
    const val = (r: Row): number | string => (sort.key === 'game' ? gameName(r) : sort.key === 'date' ? r.date : (r[sort.key] ?? -Infinity));
    return list.sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      const c = typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number);
      return c * sort.dir || b.date.localeCompare(a.date);
    });
  }, [entries, grouped, query, sort]);

  const totals = toRowSafe(entries);
  const shown = showAll ? rows : rows.slice(0, PAGE);

  const exportCsv = () => {
    const head = ['date', 'game', `spend_${fmt.currency}`, `revenue_${fmt.currency}`, `net_${fmt.currency}`, 'roas', 'installs', 'note'];
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const lines = rows.map((r) =>
      [r.date, gameName(r), r.spend.toFixed(2), r.revenue.toFixed(2), r.net.toFixed(2), r.roas === null ? '' : r.roas.toFixed(4), r.installs ?? '', r.note]
        .map((v) => esc(String(v)))
        .join(','),
    );
    const blob = new Blob([[head.join(','), ...lines].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `zyro-ledger-${fileLabel}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <Panel
      id="ledger"
      title="Ledger"
      sub={`${rows.length} ${grouped ? (rows.length === 1 ? 'day' : 'days') : rows.length === 1 ? 'entry' : 'entries'} in this range`}
      wide={wide}
      tools={
        <>
          <label className="search">
            <Icon name="search" size={14} />
            <input type="search" placeholder="Search dates, games, notes" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search ledger" />
          </label>
          <Toggle on={grouped} onChange={setGrouped} label="One row per day" />
          <button type="button" className="btn btn-ghost" onClick={exportCsv} disabled={!rows.length}>
            <Icon name="download" size={14} /> Export CSV
          </button>
        </>
      }
    >
      <div className="table-wrap">
        <table className="data-table ledger">
          <thead>
            <tr>
              {COLS.map((c) => (
                <th key={c.key} className={c.num ? 'num' : ''} aria-sort={sort.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? (s.dir === 1 ? -1 : 1) : c.key === 'date' || c.key === 'game' ? 1 : -1 }))}>
                    {c.label}
                    <span className="sort-ind" aria-hidden="true">
                      {sort.key === c.key ? (sort.dir === 1 ? '↑' : '↓') : ''}
                    </span>
                  </button>
                </th>
              ))}
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.key} className="clickable" onClick={() => onPickDay(r.date)}>
                <td className="nowrap">
                  <button type="button" className="row-link" onClick={(e) => (e.stopPropagation(), onPickDay(r.date))}>
                    {fmtDate(r.date, 'long')}
                  </button>
                </td>
                <td className="nowrap">
                  <span className="cell-game">
                    {r.gameCount === 1 ? <GameAvatar game={r.game ? byId.get(r.game) : undefined} size={18} /> : null}
                    {gameName(r)}
                  </span>
                </td>
                <td className="num">{fmt.money(r.spend)}</td>
                <td className="num">{fmt.money(r.revenue)}</td>
                <td className={`num ${r.net > 0 ? 'pos' : r.net < 0 ? 'neg' : ''}`}>{fmt.money(r.net, { sign: true })}</td>
                <td className="num">{pct(r.roas)}</td>
                <td className="num">{r.installs === null ? '—' : num(r.installs)}</td>
                <td className="num">{r.cpi === null ? '—' : fmt.money(r.cpi)}</td>
                <td className="note">{r.note || <span className="muted">—</span>}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={9} className="empty-cell">
                  {query ? 'Nothing matches that search.' : 'No entries in this range.'}
                </td>
              </tr>
            ) : null}
          </tbody>
          {totals && rows.length ? (
            <tfoot>
              <tr>
                <td colSpan={2}>Range total</td>
                <td className="num">{fmt.money(totals.spend)}</td>
                <td className="num">{fmt.money(totals.revenue)}</td>
                <td className={`num ${totals.net > 0 ? 'pos' : totals.net < 0 ? 'neg' : ''}`}>{fmt.money(totals.net, { sign: true })}</td>
                <td className="num">{pct(totals.roas)}</td>
                <td className="num">{totals.installs === null ? '—' : num(totals.installs)}</td>
                <td className="num">{totals.cpi === null ? '—' : fmt.money(totals.cpi)}</td>
                <td />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
      {rows.length > PAGE ? (
        <button type="button" className="btn btn-ghost more" onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Show fewer' : `Show all ${rows.length}`}
        </button>
      ) : null}
    </Panel>
  );
}

function toRowSafe(entries: Entry[]): Row | null {
  return entries.length ? toRow(entries, 'total') : null;
}
