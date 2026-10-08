import { useState } from 'react';
import { ChevronDown, GanttChart } from 'lucide-react';
import type { DayStats } from '../lib/stats.ts';
import { fmtDayKey, fmtDuration } from '../lib/format.ts';
import { DayStrip, HourTicks } from './DayStrip.tsx';

const COLLAPSED_ROWS = 14;
const ROW = 'grid grid-cols-[1fr_auto] md:grid-cols-[7rem_1fr_5.5rem] gap-x-3 gap-y-1.5 items-center';

/** One 24h strip per day, newest first */
export function DayTimeline({ days, now }: { days: DayStats[]; now: number }) {
  const [expanded, setExpanded] = useState(false);
  const rows = [...days].reverse();
  const visible = expanded ? rows : rows.slice(0, COLLAPSED_ROWS);

  return (
    <div className="card">
      <div className="card-head justify-between flex-wrap">
        <div className="flex items-center gap-3">
          <div className="card-icon">
            <GanttChart />
          </div>
          <div>
            <h2 className="card-title">Погодинно</h2>
            <p className="card-sub">Кожен рядок — доба з 00:00 до 24:00</p>
          </div>
        </div>
        <Legend />
      </div>

      {/* Phones: label row above a full-width strip. md+: label | strip | total */}
      <div className={`${ROW} pb-1`}>
        <span className="hidden md:block" />
        <div className="col-span-2 md:col-span-1 md:order-2">
          <HourTicks />
        </div>
        <span className="hidden md:block md:order-3 text-[10px] text-slate-400 text-right">без світла</span>
      </div>

      <div className="divide-y divide-slate-100 md:divide-y-0">
        {visible.map(d => (
          <div key={d.key} className={`${ROW} py-2 md:py-1`}>
            <span className="text-xs text-slate-600 first-letter:uppercase truncate">{fmtDayKey(d.key)}</span>
            <span className={`md:order-3 text-xs font-mono text-right ${d.offMs > 0 ? 'text-rose-700 font-semibold' : 'text-slate-400'}`}>
              {d.offMs > 0 ? fmtDuration(d.offMs) : '—'}
            </span>
            <div className="col-span-2 md:col-span-1 md:order-2">
              <DayStrip start={d.start} end={d.end} periods={d.periods} now={now} height="h-4" />
            </div>
          </div>
        ))}
      </div>

      {rows.length > COLLAPSED_ROWS && (
        <button type="button" className="btn btn-secondary w-full mt-4" onClick={() => setExpanded(e => !e)}>
          {expanded ? 'Згорнути' : `Показати всі ${rows.length} днів`}
          <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      )}
    </div>
  );
}

export function Legend() {
  return (
    <div className="flex items-center gap-3 text-xs text-slate-600">
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded bg-[var(--color-on)]" /> Є світло
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded bg-[var(--color-off)]" /> Немає
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded strip-empty ring-1 ring-inset ring-slate-200" /> Невідомо
      </span>
    </div>
  );
}
