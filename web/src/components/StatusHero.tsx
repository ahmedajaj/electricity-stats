import { Clock, Zap, ZapOff } from 'lucide-react';
import type { DayStats, Period } from '../lib/stats.ts';
import { fmtDate, fmtDuration, fmtTime, plural } from '../lib/format.ts';
import { DayStrip, HourTicks } from './DayStrip.tsx';

interface Props {
  periods: Period[];
  today: DayStats;
  now: number;
}

export function StatusHero({ periods, today, now }: Props) {
  const current = periods[periods.length - 1];
  const previous = periods[periods.length - 2];
  if (!current) return null;

  const isOn = current.status === 'on';
  const accent = isOn ? 'text-emerald-600' : 'text-rose-600';
  const Icon = isOn ? Zap : ZapOff;

  return (
    <div className="card animate-fade-up">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 mb-6">
        <div className="flex items-start gap-4">
          <div
            className={`grid place-items-center w-14 h-14 md:w-16 md:h-16 shrink-0 rounded-2xl shadow-md ${
              isOn ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
            }`}
          >
            <Icon className="w-7 h-7 md:w-8 md:h-8" strokeWidth={2.25} />
          </div>
          <div>
            <div className="flex items-center gap-2 text-[13px] font-medium text-slate-600 mb-1">
              <span className="relative flex w-2 h-2">
                <span className={`absolute inset-0 rounded-full animate-ping opacity-60 ${isOn ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                <span className={`relative w-2 h-2 rounded-full ${isOn ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              </span>
              {isOn ? 'Є світло' : 'Немає світла'} вже
            </div>
            <div className={`text-4xl md:text-5xl font-bold tracking-tighter leading-none ${accent}`}>
              {fmtDuration(now - current.start)}
            </div>
            <div className="text-[13px] text-slate-600 mt-2">
              з <span className="font-mono font-semibold text-slate-900">{fmtTime(current.start)}</span>
              <span className="text-slate-400"> · </span>
              {fmtDate(current.start)}
              {previous && (
                <>
                  <span className="text-slate-400"> · </span>
                  до цього {previous.status === 'on' ? 'світло було' : 'світла не було'} {fmtDuration(previous.end - previous.start)}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1.5">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="text-2xl md:text-3xl font-semibold font-mono tracking-tight text-slate-900">{fmtTime(now)}</span>
          </div>
          <div className="text-[13px] text-slate-600 first-letter:uppercase">{fmtDate(now)}</div>
        </div>
      </div>

      <div className="inset p-3.5 md:p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-3">
          <span className="text-sm font-semibold text-slate-900">Сьогодні</span>
          <span className="text-[13px] text-slate-600">
            без світла <b className="font-semibold text-slate-900">{fmtDuration(today.offMs)}</b>
            <span className="text-slate-400"> · </span>
            {today.outages} {plural(today.outages, 'відключення', 'відключення', 'відключень')}
          </span>
        </div>
        <DayStrip start={today.start} end={today.end} periods={today.periods} now={now} height="h-5" />
        <div className="mt-1.5">
          <HourTicks />
        </div>
      </div>
    </div>
  );
}
