import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TooltipContentProps } from 'recharts';
import { useAreaHistory } from '../hooks/useAreaHistory.ts';
import { AXIS, GRID, OFF, ON, TICK } from '../lib/colors.ts';
import { fmtDate, fmtTime } from '../lib/format.ts';
import type { Period } from '../lib/stats.ts';

const RANGES = [
  { days: 1, label: '24 год' },
  { days: 7, label: '7 днів' },
  { days: 30, label: '30 днів' },
];
const MAX_POINTS = 300;
// Samples come every 5 min; a longer silence (server down, feed broken) breaks the lines
const GAP_MS = 15 * 60_000;

// Our complex stands out, the city is the grey baseline
const AREA_COLORS: Record<string, string> = {
  patriotyka: '#4f46e5',
  osokorky: '#f59e0b',
  kyiv: '#94a3b8',
};

type Point = { t: number } & Record<string, number | null>;

/** Average every area into at most MAX_POINTS buckets and insert breaks where samples are missing */
function toPoints(rows: (number | null)[][], ids: string[], from: number, to: number): Point[] {
  const bucket = Math.max(5 * 60_000, Math.ceil((to - from) / MAX_POINTS));
  const sums = new Map<number, { sum: number; n: number }[]>();
  for (const r of rows) {
    const key = Math.floor((r[0] as number) / bucket) * bucket;
    const b = sums.get(key) ?? ids.map(() => ({ sum: 0, n: 0 }));
    ids.forEach((_, i) => {
      const share = r[i + 1];
      if (share == null) return;
      b[i].sum += share;
      b[i].n += 1;
    });
    sums.set(key, b);
  }
  const points: Point[] = [];
  const gap = (t: number): Point => Object.assign({ t }, ...ids.map(id => ({ [id]: null })));
  let prev: number | null = null;
  for (const [t, b] of [...sums].sort((x, y) => x[0] - y[0])) {
    if (prev != null && t - prev > Math.max(GAP_MS, bucket * 2)) points.push(gap(prev + bucket));
    points.push(Object.assign({ t }, ...ids.map((id, i) => ({ [id]: b[i].n ? Math.round((b[i].sum / b[i].n) * 100) : null }))));
    prev = t;
  }
  return points;
}

/** Share of points with power over time, one line per selected area; optionally shaded by our own on/off periods */
export function AreaHistoryChart({ areas, periods }: { areas: { id: string; name: string }[]; periods: Period[] }) {
  const [days, setDays] = useState(1);
  const [showHome, setShowHome] = useState(false);
  const [selected, setSelected] = useState(() => new Set(areas.map(a => a.id)));
  const { history, error } = useAreaHistory(days);

  const points = useMemo(() => {
    if (!history || history.rows.length === 0) return [];
    const to = history.rows[history.rows.length - 1][0] as number;
    return toPoints(history.rows, history.ids, to - days * 24 * 60 * 60_000, to);
  }, [history, days]);

  // Our on/off periods clipped to the chart's time span
  const homeBands = useMemo(() => {
    if (points.length < 2) return [];
    const from = points[0].t;
    const to = points[points.length - 1].t;
    return periods
      .filter(p => p.end > from && p.start < to)
      .map(p => ({ status: p.status, x1: Math.max(p.start, from), x2: Math.min(p.end, to) }));
  }, [periods, points]);

  const shown = areas.filter(a => selected.has(a.id) && history?.ids.includes(a.id));
  const fmtTick = (t: number) => (days === 1 ? fmtTime(t) : fmtDate(t));

  // At least one area stays on
  const toggle = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id);
      } else next.add(id);
      return next;
    });

  const renderTooltip = ({ active, payload }: TooltipContentProps) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload as Point;
    if (shown.every(a => d[a.id] == null)) return null;
    const home = showHome ? periods.find(p => p.start <= d.t && d.t < p.end) : undefined;
    return (
      <div className="bg-white/95 backdrop-blur ring-1 ring-slate-200 rounded-xl px-3 py-2 shadow-lg text-sm">
        <p className="font-mono text-xs text-slate-600 mb-1">
          {fmtDate(d.t)}, {fmtTime(d.t)}
        </p>
        {shown.map(a => (
          <p key={a.id} className="flex items-center gap-1.5 text-slate-700">
            <span className="w-2 h-2 rounded-full" style={{ background: AREA_COLORS[a.id] }} />
            {a.name} <span className="font-mono font-semibold text-slate-900 ml-auto pl-3">{d[a.id] ?? '—'}%</span>
          </p>
        ))}
        {home && (
          <p className={`flex items-center gap-1.5 mt-1 pt-1 border-t border-slate-200 ${home.status === 'on' ? 'text-emerald-700' : 'text-rose-700'}`}>
            <span className="w-2 h-2 rounded-sm" style={{ background: home.status === 'on' ? ON : OFF }} />
            Русової 7А: {home.status === 'on' ? 'є світло' : 'немає світла'}
          </p>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex flex-wrap gap-1.5">
          {areas.map(a => {
            const on = selected.has(a.id);
            return (
              <button
                key={a.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(a.id)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors ${
                  on ? 'bg-white text-slate-900 ring-slate-300 shadow-sm' : 'bg-transparent text-slate-500 ring-slate-200 hover:text-slate-900'
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: on ? AREA_COLORS[a.id] : '#cbd5e1' }} />
                {a.name}
              </button>
            );
          })}
          <button
            type="button"
            aria-pressed={showHome}
            onClick={() => setShowHome(v => !v)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors ${
              showHome ? 'bg-white text-slate-900 ring-slate-300 shadow-sm' : 'bg-transparent text-slate-500 ring-slate-200 hover:text-slate-900'
            }`}
          >
            <span className="flex w-3 h-2 rounded-sm overflow-hidden">
              <span className="flex-1" style={{ background: showHome ? ON : '#cbd5e1' }} />
              <span className="flex-1" style={{ background: showHome ? OFF : '#e2e8f0' }} />
            </span>
            Світло в Русової 7А
          </button>
        </div>
        <div className="seg">
          {RANGES.map(r => (
            <button key={r.days} type="button" className="seg-btn !py-1 text-xs" aria-pressed={days === r.days} onClick={() => setDays(r.days)}>
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div className="h-56 -ml-2">
        {points.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              {showHome &&
                homeBands.map(b => (
                  <ReferenceArea key={b.x1} x1={b.x1} x2={b.x2} fill={b.status === 'on' ? ON : OFF} fillOpacity={b.status === 'on' ? 0.1 : 0.16} strokeOpacity={0} ifOverflow="hidden" />
                ))}
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                stroke={AXIS}
                tick={{ fill: TICK, fontSize: 11 }}
                tickLine={false}
                tickFormatter={fmtTick}
                minTickGap={32}
              />
              <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} stroke={AXIS} tick={{ fill: TICK, fontSize: 11 }} tickLine={false} width={40} tickFormatter={v => `${v}%`} />
              <Tooltip content={renderTooltip} />
              {shown.map(a => (
                <Line key={a.id} dataKey={a.id} type="monotone" stroke={AREA_COLORS[a.id]} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full grid place-items-center text-xs text-slate-500 text-center px-4">
            {error ? 'Не вдалося завантажити історію' : history ? 'Історія збирається: точки додаються кожні 5 хвилин' : 'Завантаження…'}
          </div>
        )}
      </div>
    </div>
  );
}
