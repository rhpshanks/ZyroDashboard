import { Fragment, useEffect, useMemo, useState } from 'react';
import { dataset, makeDemoEntries } from './data';
import type { Gran } from './types';
import { makeFmt } from './lib/format';
import { buildDays, bucketize, indexEntries, PRESETS, previousRange, resolveRange, summarize } from './lib/metrics';
import { daysInMonth, diffDays, endOfMonth, fmtDate, minISO, startOfMonth, todayISO } from './lib/date';
import { usePrefs, type PanelPref } from './lib/prefs';
import { Header, FilterBar } from './components/Chrome';
import { Hero } from './components/Hero';
import { KpiRow } from './components/Kpis';
import { DailyPanel } from './components/charts/DailyPanel';
import { PaybackPanel, RoasPanel } from './components/charts/TrendPanels';
import { CalendarPanel, GamesPanel, WeekdayPanel } from './components/charts/PatternPanels';
import { GoalsPanel, SimulatorPanel } from './components/PlanPanels';
import { Ledger } from './components/Ledger';
import { DayDrawer } from './components/DayDrawer';
import { CustomizeDrawer } from './components/CustomizeDrawer';
import { Icon } from './components/ui';

const demo = dataset.entries.length === 0;

export default function App() {
  const [prefs, update, reset] = usePrefs();
  const [customizing, setCustomizing] = useState(false);
  const [openDay, setOpenDay] = useState<string | null>(null);

  const baseEntries = useMemo(() => (demo ? makeDemoEntries() : dataset.entries), []);
  const rate = prefs.pkrPerUsd ?? dataset.settings.pkrPerUsd;
  const unit = prefs.currency === 'PKR' ? rate : 1;
  const fmt = useMemo(() => makeFmt(prefs.currency), [prefs.currency]);

  // Everything downstream works in the display currency.
  const entries = useMemo(
    () => (unit === 1 ? baseEntries : baseEntries.map((e) => ({ ...e, spend: e.spend * unit, revenue: e.revenue * unit }))),
    [baseEntries, unit],
  );
  const { first, last } = useMemo(() => {
    const dates = baseEntries.map((e) => e.date).sort();
    return { first: dates[0] ?? null, last: dates[dates.length - 1] ?? null };
  }, [baseEntries]);
  const anchor = last ?? todayISO();
  const range = resolveRange(prefs.range, anchor, first ?? anchor);
  const prev = previousRange(range);

  const byDate = useMemo(() => indexEntries(entries, prefs.games), [entries, prefs.games]);
  const days = useMemo(() => buildDays(byDate, range.start, range.end), [byDate, range.start, range.end]);
  const prevDays = useMemo(() => buildDays(byDate, prev.start, prev.end), [byDate, prev.start, prev.end]);
  const sum = useMemo(() => summarize(days), [days]);
  const prevSum = useMemo(() => summarize(prevDays), [prevDays]);
  const rangeEntries = useMemo(() => days.flatMap((d) => d.entries), [days]);

  // Month context (goals, projection) follows the month the range ends in, up to the latest data.
  const mStart = startOfMonth(range.end);
  const mEnd = minISO(endOfMonth(range.end), anchor < mStart ? mStart : anchor);
  const monthDays = useMemo(() => buildDays(byDate, mStart, mEnd), [byDate, mStart, mEnd]);
  const monthSum = useMemo(() => summarize(monthDays), [monthDays]);
  const dim = daysInMonth(range.end);
  const elapsed = Math.min(dim, diffDays(mStart, mEnd) + 1);
  const projection = monthSum.tracked ? (monthSum.net / monthSum.tracked) * dim : null;

  const autoGran: Gran = range.days <= 92 ? 'day' : range.days <= 400 ? 'week' : 'month';
  const gran: Gran = prefs.daily.gran === 'auto' ? autoGran : prefs.daily.gran;
  const buckets = useMemo(() => bucketize(days, gran), [days, gran]);

  const goal = (prefs.monthlyProfitGoal ?? dataset.settings.monthlyProfitGoal) * unit;
  const budget = (prefs.monthlySpendBudget ?? dataset.settings.monthlySpendBudget) * unit;
  const hasUntagged = baseEntries.some((e) => !e.game);

  const dayRow = openDay ? (days.find((d) => d.date === openDay) ?? buildDays(byDate, openDay, openDay)[0]) : null;

  const toggleTheme = () => {
    const effective =
      prefs.theme === 'system' ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : prefs.theme;
    update({ theme: effective === 'light' ? 'dark' : 'light' });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
      if (e.key === 'Escape') {
        setOpenDay(null);
        setCustomizing(false);
        return;
      }
      if (customizing || openDay) return;
      const n = Number(e.key);
      if (n >= 1 && n <= PRESETS.length) update({ range: { preset: PRESETS[n - 1].id } });
      else if (e.key.toLowerCase() === 'c') setCustomizing(true);
      else if (e.key.toLowerCase() === 't') toggleTheme();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => {
    document.body.style.overflow = customizing || openDay ? 'hidden' : '';
  }, [customizing, openDay]);

  const zoom = (start: string, end: string) => update({ range: { preset: 'custom', start, end } });
  const toggleGame = (id: string) => update({ games: prefs.games.includes(id) ? prefs.games.filter((g) => g !== id) : [...prefs.games, id] });

  const render = (p: PanelPref) => {
    switch (p.id) {
      case 'hero':
        return <Hero sum={sum} prevSum={prevSum} range={range} fmt={fmt} />;
      case 'kpis':
        return (
          <KpiRow
            ids={prefs.kpis}
            sum={sum}
            prevSum={prevSum}
            days={days}
            fmt={fmt}
            rangeDays={range.days}
            month={{ label: fmtDate(range.end, 'month'), net: monthSum.net, projection }}
            onPickDay={setOpenDay}
          />
        );
      case 'daily':
        return (
          <DailyPanel
            buckets={buckets}
            gran={gran}
            prefs={prefs.daily}
            update={(d) => update((x) => ({ daily: { ...x.daily, ...d } }))}
            fmt={fmt}
            wide={p.wide}
            onZoom={zoom}
            onPickDay={setOpenDay}
          />
        );
      case 'payback':
        return <PaybackPanel days={days} fmt={fmt} wide={p.wide} onPickDay={setOpenDay} />;
      case 'roas':
        return <RoasPanel days={days} windowSize={prefs.roasWindow} setWindow={(n) => update({ roasWindow: n })} fmt={fmt} wide={p.wide} onPickDay={setOpenDay} />;
      case 'calendar':
        return <CalendarPanel days={days} fmt={fmt} wide={p.wide} onPickDay={setOpenDay} />;
      case 'weekday':
        return <WeekdayPanel days={days} metric={prefs.weekdayMetric} setMetric={(m) => update({ weekdayMetric: m })} fmt={fmt} wide={p.wide} />;
      case 'games':
        return (
          <GamesPanel
            entries={rangeEntries}
            games={dataset.games}
            selected={prefs.games}
            onToggle={toggleGame}
            fmt={fmt}
            wide={p.wide}
            playStoreUrl={dataset.playStoreUrl}
          />
        );
      case 'goals':
        return (
          <GoalsPanel
            monthLabel={fmtDate(range.end, 'monthLong').split(' ')[0]}
            month={monthSum}
            dim={dim}
            elapsed={elapsed}
            goal={goal}
            budget={budget}
            onGoal={(v) => update({ monthlyProfitGoal: v / unit })}
            onBudget={(v) => update({ monthlySpendBudget: v / unit })}
            fmt={fmt}
            wide={p.wide}
          />
        );
      case 'simulator':
        return <SimulatorPanel sum={sum} unit={unit} fmt={fmt} wide={p.wide} />;
      case 'ledger':
        return <Ledger entries={rangeEntries} games={dataset.games} fmt={fmt} onPickDay={setOpenDay} fileLabel={`${range.start}_${range.end}`} wide={p.wide} />;
    }
  };

  return (
    <div className="app">
      <div className="atmosphere" aria-hidden="true" />
      <Header
        lastDate={last}
        demo={demo}
        theme={prefs.theme}
        onTheme={toggleTheme}
        onCustomize={() => setCustomizing(true)}
        playStoreUrl={dataset.playStoreUrl}
      />
      {demo ? (
        <div className="demo-banner" role="note">
          <Icon name="info" />
          <p>
            <b>These are sample numbers.</b> Send Claude a day's Google Ads spend and AdMob revenue and your real figures replace them on the next deploy.
          </p>
        </div>
      ) : null}
      <FilterBar
        prefs={prefs}
        update={update}
        range={range}
        games={dataset.games}
        bounds={{ min: first ?? anchor, max: anchor }}
        hasUntagged={hasUntagged}
      />
      <main className="grid">
        {prefs.panels
          .filter((p) => p.visible)
          .map((p) => (
            <Fragment key={p.id}>{render(p)}</Fragment>
          ))}
        {!prefs.panels.some((p) => p.visible) ? (
          <div className="panel wide empty-layout">
            <p>Every panel is hidden.</p>
            <button type="button" className="btn btn-primary" onClick={() => setCustomizing(true)}>
              Open Customize
            </button>
          </div>
        ) : null}
      </main>
      <footer className="footer">
        <span className="footer-tags">
          IDLE <i className="dot red" /> HYBRID CASUAL <i className="dot green" /> PUZZLE
        </span>
        <span>{dataset.studio} · Google Ads spend vs AdMob revenue</span>
      </footer>

      {dayRow ? (
        <DayDrawer day={dayRow} days={days} sum={sum} games={dataset.games} fmt={fmt} onClose={() => setOpenDay(null)} onNav={setOpenDay} />
      ) : null}
      {customizing ? (
        <CustomizeDrawer prefs={prefs} update={update} reset={reset} settings={dataset.settings} onClose={() => setCustomizing(false)} />
      ) : null}
    </div>
  );
}
