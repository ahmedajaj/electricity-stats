import { useState } from 'react';
import { CalendarDays, ChevronDown } from 'lucide-react';
import type { DayStats } from '../lib/stats.ts';
import { HOUR, weekday } from '../lib/time.ts';
import { fmtDayKey, fmtDuration, fmtMonth, plural } from '../lib/format.ts';

const COLLAPSED_MONTHS = 4;
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

// Hours without power → cell tone: green → yellow → orange → red → dark red, so neighbours differ in hue, not just shade
const LEVELS: { max: number; cls: string; label: string }[] = [
  { max: 0, cls: 'bg-emerald-100 text-emerald-800 ring-emerald-300', label: '0' },
  { max: 2, cls: 'bg-yellow-100 text-yellow-900 ring-yellow-300', label: '<2' },
  { max: 4, cls: 'bg-amber-300 text-amber-950 ring-amber-400', label: '2–4' },
  { max: 8, cls: 'bg-orange-500 text-white ring-orange-600', label: '4–8' },
  { max: 12, cls: 'bg-red-600 text-white ring-red-700', label: '8–12' },
  { max: Infinity, cls: 'bg-red-950 text-white ring-red-950', label: '12+' },
];

function level(d: DayStats) {
  const h = d.offMs / HOUR;
  return LEVELS.find(l => (l.max === 0 ? h === 0 : h < l.max)) ?? LEVELS[LEVELS.length - 1];
}

/** Month grids where each day is shaded by hours without power; `days` covers whole months, oldest first */
export function OutageCalendar({ days, today }: { days: DayStats[]; today: string }) {
  const months = new Map<string, DayStats[]>();
  for (const d of days) {
    const m = d.key.slice(0, 7);
    months.set(m, [...(months.get(m) ?? []), d]);
  }
  const [expanded, setExpanded] = useState(false);
  // Chronological like a wall calendar; collapsed keeps the latest months
  const all = [...months.entries()];
  const visible = expanded ? all : all.slice(-COLLAPSED_MONTHS);

  return (
    <div className="card h-full">
      <div className="card-head justify-between flex-wrap">
        <div className="flex items-center gap-3">
          <div className="card-icon">
            <CalendarDays />
          </div>
          <div>
            <h2 className="card-title">Календар</h2>
            <p className="card-sub">Години без світла за добу</p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[10px] font-mono text-slate-500">
          {LEVELS.map(l => (
            <span key={l.label} className={`px-1.5 py-0.5 rounded ring-1 ring-inset ${l.cls}`}>
              {l.label}
            </span>
          ))}
          <span className="ml-0.5">год</span>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {visible.map(([month, monthDays]) => (
          <div key={month}>
            <div className="text-sm font-semibold text-slate-900 first-letter:uppercase mb-2">{fmtMonth(monthDays[0].key)}</div>
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS.map(w => (
                <span key={w} className="text-[10px] font-medium text-slate-500 text-center pb-0.5">
                  {w}
                </span>
              ))}
              {Array.from({ length: weekday(monthDays[0].key) }, (_, i) => (
                <span key={`pad-${i}`} />
              ))}
              {monthDays.map(d => {
                if (d.key > today) {
                  return (
                    <div key={d.key} className="aspect-square rounded-lg grid place-items-center text-[11px] font-medium text-slate-300 ring-1 ring-inset ring-slate-100">
                      {Number(d.key.slice(8))}
                    </div>
                  );
                }
                const known = d.onMs + d.offMs > 0;
                const l = level(d);
                return (
                  <div
                    key={d.key}
                    className={`aspect-square rounded-lg grid place-items-center text-[11px] font-semibold ring-1 ring-inset ${
                      known ? l.cls : 'strip-empty text-slate-400 ring-slate-200'
                    } ${d.key === today ? 'outline-2 outline-offset-1 outline-slate-900' : ''}`}
                    title={
                      known
                        ? `${fmtDayKey(d.key)}: без світла ${fmtDuration(d.offMs)}, ${d.outages} ${plural(d.outages, 'відключення', 'відключення', 'відключень')}`
                        : `${fmtDayKey(d.key)}: немає даних`
                    }
                  >
                    {Number(d.key.slice(8))}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {all.length > COLLAPSED_MONTHS && (
        <button type="button" className="btn btn-secondary w-full mt-5" onClick={() => setExpanded(e => !e)}>
          {expanded ? 'Згорнути' : `Показати всі місяці (${all.length})`}
          <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      )}
    </div>
  );
}
