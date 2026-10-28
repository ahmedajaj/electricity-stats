import { useState } from 'react';
import type { ReactNode } from 'react';
import { CalendarClock, CheckCheck, ChevronDown, PencilLine, Siren, SunMedium, ZapOff } from 'lucide-react';
import type { Period } from '../lib/stats.ts';
import type { DayComparison, PlanSegment, ScheduleArchive } from '../lib/schedule.ts';
import { SCHEDULE_APPLIES, changeTimes, compareDay, dayPromisedShare, latestPlan, summarizeComparisons } from '../lib/schedule.ts';
import { addDays, dayBounds, dayKey } from '../lib/time.ts';
import { fmtDayKey, fmtDayShort, fmtDuration, fmtPercent, fmtTime } from '../lib/format.ts';
import { DayStrip, HourTicks } from './DayStrip.tsx';
import { Tile } from './SummaryTiles.tsx';

const COLLAPSED_DAYS = 7;
const DAY_ROW = 'grid grid-cols-1 md:grid-cols-[8.5rem_1fr_15rem] gap-x-4 gap-y-2 md:items-center';
/** Ignore a few minutes of mismatch around outage edges */
const EDGE_MS = 5 * 60_000;

interface Props {
  archive: ScheduleArchive;
  periods: Period[];
  now: number;
}

/** ДТЕК planned schedule for our group vs what actually happened */
export function ScheduleCompare({ archive, periods, now }: Props) {
  const [expanded, setExpanded] = useState(false);
  const today = dayKey(now);
  const tomorrow = addDays(today, 1);
  const keys = Object.keys(archive.days).filter(k => k <= today).sort();
  const firstDay = keys[0];

  const comparisons = keys.map(k => compareDay(k, archive.days[k], periods, now));
  const todayCmp = comparisons.find(c => c.key === today);
  const summary = summarizeComparisons(comparisons);
  const pastDays = comparisons.filter(c => c.key < today).reverse();
  const visibleDays = expanded ? pastDays : pastDays.slice(0, COLLAPSED_DAYS);

  const todayLatest = latestPlan(today, archive.days[today]);
  const tomorrowLatest = latestPlan(tomorrow, archive.days[tomorrow]);
  const [todayStart, todayEnd] = dayBounds(today);
  const todayFact = clipToDay(periods, todayStart, todayEnd);

  return (
    <div className="card">
      <div className="card-head justify-between flex-wrap">
        <div className="flex items-center gap-3">
          <div className="card-icon">
            <CalendarClock />
          </div>
          <div>
            <h2 className="card-title">Графік ДТЕК і факт</h2>
            <p className="card-sub">
              Група {archive.group}
              {firstDay && <> · графік збирається з {fmtDayShort(firstDay)}</>}
            </p>
          </div>
        </div>
        <StatusChip status={todayLatest.status} />
      </div>

      {/* Today: plan vs fact */}
      <div className="inset p-3.5 md:p-4 mb-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-3">
          <span className="text-sm font-semibold text-slate-900">Сьогодні</span>
          <span className="text-[13px] text-slate-600">{nextPlannedText(todayLatest.plan, todayLatest.status, now, todayEnd)}</span>
        </div>
        <div className="grid grid-cols-[2.75rem_1fr] gap-x-3 gap-y-1.5 items-center">
          <span className="text-xs text-slate-500">План</span>
          <PlanStrip start={todayStart} end={todayEnd} plan={todayCmp?.plan ?? todayLatest.plan} now={now} markers={todayCmp?.changed ? changeTimes(today, archive.days[today]) : []} />
          <span className="text-xs text-slate-500">Факт</span>
          <DayStrip start={todayStart} end={todayEnd} periods={todayFact} now={now} height="h-3.5" />
          <span />
          <HourTicks />
        </div>
        {todayCmp?.changed && (
          <p className="text-xs text-slate-500 mt-2">Графік на сьогодні змінено — позначка ▾ на смузі плану показує, коли</p>
        )}

        <div className="border-t border-slate-200 mt-3.5 pt-3">
          {tomorrowLatest.status === SCHEDULE_APPLIES ? (
            <div className="grid grid-cols-[2.75rem_1fr] gap-x-3 gap-y-1.5 items-center">
              <span className="text-xs text-slate-500">Завтра</span>
              <PlanStrip start={dayBounds(tomorrow)[0]} end={dayBounds(tomorrow)[1]} plan={tomorrowLatest.plan} />
              <span />
              <span className="text-xs text-slate-600">{offWindowsText(tomorrowLatest.plan, dayBounds(tomorrow)[1]) || 'Відключень не заплановано'}</span>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Завтра: {tomorrowLatest.status && tomorrowLatest.status !== 'WaitingForSchedule' ? statusLabel(tomorrowLatest.status) : 'графік ще не опубліковано'}
            </p>
          )}
        </div>
      </div>

      {/* Totals since collection started */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-1">
        <Tile
          wrap
          icon={<CheckCheck />}
          tone="emerald"
          label="Світло, коли обіцяли"
          value={summary.promisedShare == null ? '—' : fmtPercent(summary.promisedShare)}
          hint="частка часу без планових відключень, коли світло справді було"
        />
        <Tile wrap icon={<ZapOff />} tone="rose" label="Поза графіком" value={fmtDuration(summary.unplannedOffMs)} hint="без світла, хоча відключень не планували" />
        <Tile
          wrap
          icon={<SunMedium />}
          tone="amber"
          label="Бонусне світло"
          value={summary.spareOnMs > 0 ? `+${fmtDuration(summary.spareOnMs)}` : '0 хв'}
          hint={summary.bonusShare == null ? 'світло під час планових відключень' : `світло під час планових відключень — ${fmtPercent(summary.bonusShare)} їхнього часу`}
        />
        <Tile
          wrap
          icon={<PencilLine />}
          tone="violet"
          label="Днів зі зміною графіка"
          value={String(summary.daysChanged)}
          hint={summary.daysEmergency ? `екстрені відключення: ${summary.daysEmergency} дн.` : 'екстрених не було'}
        />
      </div>
      <p className="text-[11px] text-slate-500 mb-4">
        Рахується лише час, коли графік діяв. Періоди екстрених відключень не порівнюються.
      </p>

      {/* Past days */}
      {pastDays.length === 0 ? (
        <div className="inset px-4 py-5 text-center text-sm text-slate-600">
          Історія по днях з’явиться завтра — ДТЕК не зберігає минулі графіки, тож ми збираємо їх самі.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {visibleDays.map(d => (
            <DayRow key={d.key} day={d} periods={periods} />
          ))}
        </div>
      )}
      {pastDays.length > COLLAPSED_DAYS && (
        <button type="button" className="btn btn-secondary w-full mt-4" onClick={() => setExpanded(e => !e)}>
          {expanded ? 'Згорнути' : `Показати всі ${pastDays.length} днів`}
          <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      )}
    </div>
  );
}

function clipToDay(periods: Period[], start: number, end: number): Period[] {
  return periods.filter(p => p.end > start && p.start < end).map(p => ({ ...p, start: Math.max(p.start, start), end: Math.min(p.end, end) }));
}

function DayRow({ day, periods }: { day: DayComparison; periods: Period[] }) {
  const [start, end] = dayBounds(day.key);
  const kept = day.unplannedOffMs < EDGE_MS;
  const hasPromise = dayPromisedShare(day) != null;
  const hasPlannedOutages = day.plannedOffKnownMs > 0;

  return (
    <div className={`${DAY_ROW} py-3`}>
      <div>
        <div className="text-sm text-slate-800 first-letter:uppercase">{fmtDayKey(day.key)}</div>
        {(day.emergency || day.changed) && (
          <div className="text-[11px] mt-0.5 space-x-2">
            {day.emergency && <span className="text-rose-700">екстрені відключення</span>}
            {day.changed && <span className="text-slate-500">графік змінювали</span>}
          </div>
        )}
      </div>

      <div className="grid grid-cols-[2.25rem_1fr] gap-x-2 gap-y-1 items-center">
        <span className="text-[10px] text-slate-400">план</span>
        <PlanStrip start={start} end={end} plan={day.plan} height="h-2" />
        <span className="text-[10px] text-slate-400">факт</span>
        <DayStrip start={start} end={end} periods={clipToDay(periods, start, end)} height="h-2" />
      </div>

      <div className="text-xs space-y-0.5">
        {!hasPromise ? (
          <div className="text-slate-500">Графік не діяв — порівнювати нема з чим</div>
        ) : kept ? (
          <div className="flex items-center gap-1 font-medium text-emerald-700">
            <CheckCheck className="w-3.5 h-3.5 shrink-0" /> Графік дотримано
          </div>
        ) : (
          <div className="flex items-center gap-1 text-rose-700">
            <ZapOff className="w-3.5 h-3.5 shrink-0" />
            <span>
              <Num tone="rose">{fmtDuration(day.unplannedOffMs)}</Num> без світла поза графіком
            </span>
          </div>
        )}
        {hasPlannedOutages &&
          (day.spareOnMs >= EDGE_MS ? (
            <div className="flex items-center gap-1 text-emerald-700">
              <SunMedium className="w-3.5 h-3.5 shrink-0" />
              <span>
                <Num tone="emerald">+{fmtDuration(day.spareOnMs)}</Num> світла замість відключень
              </span>
            </div>
          ) : (
            <div className="text-slate-500 pl-[1.125rem]">Планові відключення відбулися</div>
          ))}
      </div>
    </div>
  );
}

/** A number inside a sentence: bold mono on a soft tint, so it stands out from the words */
function Num({ tone, children }: { tone: 'emerald' | 'rose'; children: ReactNode }) {
  const cls = tone === 'emerald' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800';
  return <span className={`font-mono font-semibold rounded px-1 py-px whitespace-nowrap ${cls}`}>{children}</span>;
}

function PlanStrip({ start, end, plan, now, markers = [], height = 'h-3.5' }: { start: number; end: number; plan: PlanSegment[]; now?: number; markers?: number[]; height?: string }) {
  const len = end - start;
  const pct = (t: number) => `${((t - start) / len) * 100}%`;
  return (
    <div className={`relative ${height} rounded-md overflow-hidden strip-empty`}>
      {plan.map(s => (
        <div
          key={s.start}
          className={`absolute inset-y-0 ${s.kind === 'none' && s.status !== 'Unknown' ? 'strip-emergency' : ''}`}
          style={{ left: pct(s.start), width: `${((s.end - s.start) / len) * 100}%`, backgroundColor: planColor(s) }}
          title={`${planLabel(s)} · ${fmtTime(s.start)}–${fmtTime(s.end)}`}
        />
      ))}
      {markers.map(m => (
        <div key={m} className="absolute -top-px w-0 h-0 border-x-[4px] border-x-transparent border-t-[6px] border-t-slate-900 -translate-x-1/2" style={{ left: pct(m) }} title={`Графік змінено о ${fmtTime(m)}`} />
      ))}
      {now !== undefined && now > start && now < end && <div className="absolute inset-y-0 w-0.5 bg-slate-900 rounded-full" style={{ left: pct(now) }} />}
    </div>
  );
}

function planColor(s: PlanSegment): string | undefined {
  if (s.kind === 'off') return 'var(--color-off)';
  if (s.kind === 'on') return 'var(--color-on)';
  if (s.kind === 'maybe') return 'oklch(85% 0.12 80)';
  return undefined;
}

function planLabel(s: PlanSegment): string {
  if (s.kind === 'off') return 'Планове відключення';
  if (s.kind === 'on') return 'За графіком світло є';
  if (s.kind === 'maybe') return 'Можливе відключення';
  return s.status === 'Unknown' ? 'Графік невідомий' : statusLabel(s.status ?? '');
}

function statusLabel(status: string): string {
  if (status === 'EmergencyShutdowns') return 'екстрені відключення, графік не діє';
  if (status === 'WaitingForSchedule') return 'графік ще не опубліковано';
  return `графік не діє (${status})`;
}

function StatusChip({ status }: { status: string | null }) {
  if (status === SCHEDULE_APPLIES) return <span className="chip chip-live">Графік діє</span>;
  if (status === 'EmergencyShutdowns') return (
    <span className="chip chip-off">
      <Siren className="w-3 h-3" /> Екстрені відключення
    </span>
  );
  return <span className="chip chip-neutral">{status ? statusLabel(status) : 'Немає даних'}</span>;
}

/** "HH:MM" with the day's end shown as 24:00 instead of 00:00 */
function fmtEnd(t: number, dayEnd: number): string {
  return t >= dayEnd ? '24:00' : fmtTime(t);
}

function offWindowsText(plan: PlanSegment[], dayEnd: number): string {
  return plan
    .filter(s => s.kind === 'off')
    .map(s => `${fmtTime(s.start)}–${fmtEnd(s.end, dayEnd)}`)
    .join(', ');
}

function nextPlannedText(plan: PlanSegment[], status: string | null, now: number, dayEnd: number): string {
  if (status && status !== SCHEDULE_APPLIES) return statusLabel(status);
  const current = plan.find(s => s.kind === 'off' && s.start <= now && s.end > now);
  if (current) return `Зараз за графіком відключення до ${fmtEnd(current.end, dayEnd)}`;
  const next = plan.find(s => s.kind === 'off' && s.start > now);
  if (next) return `Наступне за графіком: ${fmtTime(next.start)}–${fmtEnd(next.end, dayEnd)}`;
  return 'Більше відключень за графіком сьогодні немає';
}
