import { useEffect, useRef, useState } from 'react';
import type { Settings } from '../types';
import type { KpiId, PanelId, Prefs } from '../lib/prefs';
import { KPI_META, PANEL_META } from '../lib/prefs';
import { Icon, Segmented, Toggle } from './ui';

export function CustomizeDrawer({
  prefs,
  update,
  reset,
  settings,
  onClose,
}: {
  prefs: Prefs;
  update: (p: Partial<Prefs> | ((p: Prefs) => Partial<Prefs>)) => void;
  reset: (part?: 'layout' | 'all') => void;
  settings: Settings;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [rate, setRate] = useState(String(prefs.pkrPerUsd ?? settings.pkrPerUsd));
  useEffect(() => closeRef.current?.focus(), []);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= prefs.panels.length || from === to) return;
    update((p) => {
      const panels = [...p.panels];
      const [item] = panels.splice(from, 1);
      panels.splice(to, 0, item);
      return { panels };
    });
  };
  const patchPanel = (id: PanelId, patch: Partial<{ visible: boolean; wide: boolean }>) =>
    update((p) => ({ panels: p.panels.map((q) => (q.id === id ? { ...q, ...patch } : q)) }));
  const toggleKpi = (id: KpiId) =>
    update((p) => ({ kpis: p.kpis.includes(id) ? p.kpis.filter((k) => k !== id) : [...p.kpis, id] }));

  const commitRate = () => {
    const v = Number(rate);
    if (Number.isFinite(v) && v > 0) update({ pkrPerUsd: v === settings.pkrPerUsd ? null : v });
    else setRate(String(prefs.pkrPerUsd ?? settings.pkrPerUsd));
  };

  return (
    <div className="drawer-scrim" onClick={onClose}>
      <aside className="drawer customize" role="dialog" aria-modal="true" aria-labelledby="cust-title" onClick={(e) => e.stopPropagation()}>
        <header className="drawer-head">
          <div>
            <div className="eyebrow">Saved in this browser</div>
            <h2 id="cust-title">Customize</h2>
          </div>
          <button type="button" className="icon-btn" ref={closeRef} onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </header>

        <section className="cust-section">
          <div className="cust-title">
            <h3>Layout</h3>
            <button type="button" className="text-btn" onClick={() => reset('layout')}>
              Reset layout
            </button>
          </div>
          <p className="fine">Drag to reorder, or use the arrows. Half-width panels sit side by side on wide screens.</p>
          <ol className="panel-list">
            {prefs.panels.map((p, i) => {
              const meta = PANEL_META[p.id];
              return (
                <li
                  key={p.id}
                  draggable
                  className={`${p.visible ? '' : 'off'} ${dragIdx === i ? 'dragging' : ''} ${overIdx === i && dragIdx !== i ? 'over' : ''}`}
                  onDragStart={(e) => {
                    setDragIdx(i);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOverIdx(i);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragIdx !== null) move(dragIdx, i);
                    setDragIdx(null);
                    setOverIdx(null);
                  }}
                  onDragEnd={() => {
                    setDragIdx(null);
                    setOverIdx(null);
                  }}
                >
                  <span className="grip" aria-hidden="true">
                    <Icon name="grip" size={14} />
                  </span>
                  <span className="pl-text">
                    <b>{meta.title}</b>
                    <small>{meta.blurb}</small>
                  </span>
                  <span className="pl-actions">
                    {!meta.fixedWide ? (
                      <button
                        type="button"
                        className="mini-btn"
                        onClick={() => patchPanel(p.id, { wide: !p.wide })}
                        title={p.wide ? 'Make half width' : 'Make full width'}
                        aria-label={`${meta.title}: ${p.wide ? 'full width' : 'half width'}. Switch width.`}
                      >
                        {p.wide ? 'Full' : 'Half'}
                      </button>
                    ) : null}
                    <button type="button" className="mini-btn icon" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`Move ${meta.title} up`}>
                      <Icon name="up" size={13} />
                    </button>
                    <button type="button" className="mini-btn icon" onClick={() => move(i, i + 1)} disabled={i === prefs.panels.length - 1} aria-label={`Move ${meta.title} down`}>
                      <Icon name="down" size={13} />
                    </button>
                    <button
                      type="button"
                      className={`mini-btn icon ${p.visible ? 'on' : ''}`}
                      onClick={() => patchPanel(p.id, { visible: !p.visible })}
                      aria-pressed={p.visible}
                      aria-label={`${p.visible ? 'Hide' : 'Show'} ${meta.title}`}
                    >
                      <Icon name={p.visible ? 'eye' : 'eyeOff'} size={13} />
                    </button>
                  </span>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="cust-section">
          <div className="cust-title">
            <h3>Key number tiles</h3>
          </div>
          <p className="fine">Tiles appear in the order you switch them on.</p>
          <div className="chip-grid">
            {(Object.keys(KPI_META) as KpiId[]).map((id) => {
              const on = prefs.kpis.includes(id);
              return (
                <button key={id} type="button" className={`chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => toggleKpi(id)}>
                  {on ? <Icon name="check" size={13} /> : null}
                  {KPI_META[id]}
                  {on ? <span className="chip-n">{prefs.kpis.indexOf(id) + 1}</span> : null}
                </button>
              );
            })}
          </div>
        </section>

        <section className="cust-section">
          <div className="cust-title">
            <h3>Appearance</h3>
          </div>
          <div className="cust-row">
            <span>Theme</span>
            <Segmented
              label="Theme"
              value={prefs.theme}
              onChange={(v) => update({ theme: v })}
              options={[
                { value: 'dark', label: 'Dark' },
                { value: 'light', label: 'Light' },
                { value: 'system', label: 'System' },
              ]}
            />
          </div>
          <div className="cust-row">
            <span>Chart colours</span>
            <Segmented
              label="Chart colours"
              value={prefs.palette}
              onChange={(v) => update({ palette: v })}
              options={[
                { value: 'zyro', label: 'Zyro red & green' },
                { value: 'cvd', label: 'Colourblind-safe' },
              ]}
            />
          </div>
          <div className="swatches" aria-hidden="true">
            <span>
              <i style={{ background: 'var(--spend)' }} /> Spend
            </span>
            <span>
              <i style={{ background: 'var(--revenue)' }} /> Revenue
            </span>
            <span>
              <i style={{ background: 'var(--net)' }} /> Net
            </span>
          </div>
          <div className="cust-row">
            <span>Density</span>
            <Segmented
              label="Density"
              value={prefs.density}
              onChange={(v) => update({ density: v })}
              options={[
                { value: 'comfy', label: 'Comfortable' },
                { value: 'compact', label: 'Compact' },
              ]}
            />
          </div>
          <div className="cust-row">
            <span>Animation</span>
            <Toggle on={prefs.motion} onChange={(v) => update({ motion: v })} label={prefs.motion ? 'On' : 'Off'} />
          </div>
        </section>

        <section className="cust-section">
          <div className="cust-title">
            <h3>Money</h3>
          </div>
          <div className="cust-row">
            <span>Show amounts in</span>
            <Segmented
              label="Currency"
              value={prefs.currency}
              onChange={(v) => update({ currency: v })}
              options={[
                { value: 'USD', label: 'USD $' },
                { value: 'PKR', label: 'PKR Rs' },
              ]}
            />
          </div>
          <label className="cust-row">
            <span>PKR per 1 USD</span>
            <input
              className="text-input"
              inputMode="decimal"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              onBlur={commitRate}
              onKeyDown={(e) => e.key === 'Enter' && commitRate()}
            />
          </label>
          <p className="fine">Entries are stored in USD. The rate only changes how PKR is displayed. Default is {settings.pkrPerUsd}.</p>
        </section>

        <section className="cust-section">
          <div className="cust-title">
            <h3>Keyboard shortcuts</h3>
          </div>
          <ul className="shortcuts">
            <li>
              <kbd>1</kbd>–<kbd>8</kbd> Date range presets
            </li>
            <li>
              <kbd>C</kbd> Customize
            </li>
            <li>
              <kbd>T</kbd> Switch light and dark
            </li>
            <li>
              <kbd>←</kbd> <kbd>→</kbd> Move through a focused chart, <kbd>Enter</kbd> to open a day
            </li>
            <li>
              <kbd>Esc</kbd> Close panels
            </li>
          </ul>
        </section>

        <div className="cust-footer">
          <button
            type="button"
            className="btn btn-ghost danger"
            onClick={() => {
              reset('all');
              setRate(String(settings.pkrPerUsd));
            }}
          >
            <Icon name="reset" size={14} /> Reset everything
          </button>
        </div>
      </aside>
    </div>
  );
}
