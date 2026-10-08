import { useState } from 'react';
import { ArrowRight, ChevronDown, ListOrdered, ZapOff } from 'lucide-react';
import type { Outage } from '../lib/stats.ts';
import { HOUR, dayKey } from '../lib/time.ts';
import { fmtDate, fmtDuration, fmtTime } from '../lib/format.ts';

const PAGE = 10;

function durationTone(ms: number) {
  if (ms < 2 * HOUR) return 'chip-neutral';
  if (ms < 4 * HOUR) return 'bg-amber-50 text-amber-800 ring-amber-300';
  return 'chip-off';
}

export function OutageList({ outages }: { outages: Outage[] }) {
  const [shown, setShown] = useState(PAGE);
  const rows = [...outages].reverse();

  return (
    <div className="card">
      <div className="card-head">
        <div className="card-icon">
          <ListOrdered />
        </div>
        <div>
          <h2 className="card-title">Відключення</h2>
          <p className="card-sub">Від найновішого · {outages.length} за період</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="inset px-4 py-8 text-center text-sm text-slate-600">За цей період відключень не було 🎉</div>
      ) : (
        <ul className="divide-y divide-slate-200 -mx-1">
          {rows.slice(0, shown).map(o => {
            const sameDay = dayKey(o.start) === dayKey(o.end);
            return (
              <li key={o.start} className={`flex items-center gap-3 px-1 py-3 ${o.ongoing ? 'bg-rose-50/60 rounded-xl ring-1 ring-inset ring-rose-200 px-3 my-1' : ''}`}>
                <span className={`grid place-items-center w-9 h-9 rounded-xl shrink-0 ${o.ongoing ? 'bg-rose-500 text-white' : 'bg-rose-100 text-rose-600'}`}>
                  <ZapOff className="w-4 h-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 font-mono font-semibold text-slate-900">
                    {fmtTime(o.start)}
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    {o.ongoing ? <span className="font-sans text-sm text-rose-700">триває</span> : fmtTime(o.end)}
                  </div>
                  <div className="text-xs text-slate-600 first-letter:uppercase truncate">
                    {fmtDate(o.start)}
                    {!sameDay && !o.ongoing && ` → ${fmtDate(o.end)}`}
                  </div>
                </div>
                <span className={`chip text-xs px-2.5 py-1 ${durationTone(o.duration)}`}>
                  {o.ongoing && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />}
                  {fmtDuration(o.duration)}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {rows.length > shown && (
        <button type="button" className="btn btn-secondary w-full mt-4" onClick={() => setShown(s => s + PAGE * 2)}>
          Показати ще ({rows.length - shown})
          <ChevronDown className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
