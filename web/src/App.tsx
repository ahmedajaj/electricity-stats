import { useMemo, useState } from 'react';
import { MapPin, RefreshCw, Send } from 'lucide-react';
import { useEvents, useNow } from './hooks/useEvents.ts';
import { allOutages, bucketize, buildPeriods, dailyStats, firstEventDay, hourProfile, summarize } from './lib/stats.ts';
import { addDays, dayBounds, dayKey, startOfDay } from './lib/time.ts';
import { fmtTime } from './lib/format.ts';
import type { Preset, Range } from './components/PeriodPicker.tsx';
import { PeriodPicker } from './components/PeriodPicker.tsx';
import { StatusHero } from './components/StatusHero.tsx';
import { SummaryTiles } from './components/SummaryTiles.tsx';
import { DailyChart } from './components/DailyChart.tsx';
import { HourProfile } from './components/HourProfile.tsx';
import { OutageCalendar } from './components/OutageCalendar.tsx';
import { DayTimeline } from './components/DayTimeline.tsx';
import { OutageList } from './components/OutageList.tsx';
import { AreaStats } from './components/AreaStats.tsx';
import { useAreaStats } from './hooks/useAreaStats.ts';
import { ScheduleCompare } from './components/ScheduleCompare.tsx';
import { useSchedule } from './hooks/useSchedule.ts';

const CHANNEL = 'lvivskiy7a';
const PRESET_KEY = 'electricity-stats:preset';

function loadPreset(): Preset {
  try {
    const p = localStorage.getItem(PRESET_KEY);
    if (p === '7' || p === '14' || p === '30' || p === 'all') return p;
  } catch {
    /* storage unavailable */
  }
  return '14';
}

function savePreset(p: Preset) {
  try {
    localStorage.setItem(PRESET_KEY, p);
  } catch {
    /* storage unavailable */
  }
}

export default function App() {
  const { events, error, loadedAt, loading, reload } = useEvents();
  const now = useNow();
  const area = useAreaStats();
  const schedule = useSchedule();
  const [preset, setPreset] = useState<Preset>(loadPreset);
  const [custom, setCustom] = useState<{ from: string; to: string } | null>(null);

  const today = dayKey(now);
  const dataStart = useMemo(() => (events ? firstEventDay(events) : null), [events]);
  const firstDay = dataStart ?? today;

  const range: Range = useMemo(() => {
    if (preset === 'custom' && custom) return { preset, ...custom };
    if (preset === 'all') return { preset, from: firstDay, to: today };
    const from = addDays(today, -(Number(preset) - 1));
    return { preset, from: from < firstDay ? firstDay : from, to: today };
  }, [preset, custom, firstDay, today]);

  const data = useMemo(() => {
    if (!events) return null;
    const periods = buildPeriods(events, now);
    const outages = allOutages(periods, now);
    const from = startOfDay(range.from);
    const to = Math.min(dayBounds(range.to)[1], now);
    const days = dailyStats(periods, outages, range.from, range.to);
    const weekly = days.length > 62;
    return {
      periods,
      days,
      weekly,
      buckets: bucketize(days, weekly),
      summary: summarize(periods, outages, from, to),
      profile: hourProfile(periods, from, to),
      today: dailyStats(periods, outages, today, today)[0],
    };
  }, [events, now, range, today]);

  const choosePreset = (p: Preset) => {
    setPreset(p);
    savePreset(p);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 pt-6 md:pt-10 pb-12">
      <header className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3.5">
          <img src="./favicon.svg" alt="" className="w-12 h-12 md:w-14 md:h-14 rounded-2xl shadow-md" />
          <div>
            <h1 className="text-2xl md:text-[1.75rem] font-bold tracking-tight text-slate-900 leading-tight">Світло на Русової 7А</h1>
            <p className="text-[13px] md:text-sm text-slate-600 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" /> Київ · статистика відключень електроенергії
            </p>
          </div>
        </div>
        <a
          href={`https://t.me/${CHANNEL}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 h-9 px-3.5 rounded-full bg-slate-900 text-white text-[13px] font-medium shadow-sm hover:bg-slate-700 transition-colors"
        >
          <Send className="w-3.5 h-3.5" /> @{CHANNEL}
        </a>
      </header>

      {error && (
        <div className="alert-error mb-6">
          Не вдалося оновити дані ({error}).{events ? ' Показано останні завантажені.' : ''}
        </div>
      )}

      {!data ? (
        <Skeleton />
      ) : (
        <main className="space-y-9">
          <section>
            <SectionTitle n="01">Русової 7А зараз</SectionTitle>
            <StatusHero periods={data.periods} today={data.today} now={now} />
          </section>

          <section>
            <SectionTitle n="02">Район і місто</SectionTitle>
            <AreaStats stats={area.stats} error={area.error} />
          </section>

          {schedule.archive && (
            <section>
              <SectionTitle n="03">План і факт</SectionTitle>
              <ScheduleCompare archive={schedule.archive} periods={data.periods} now={now} />
            </section>
          )}

          <section>
            <SectionTitle n="04">Підсумки за період</SectionTitle>
            <div className="card space-y-5">
              <PeriodPicker
                range={range}
                min={firstDay}
                max={today}
                onPreset={choosePreset}
                onCustom={(from, to) => {
                  setCustom({ from, to });
                  setPreset('custom');
                }}
              />
              <SummaryTiles summary={data.summary} />
            </div>
          </section>

          <section className="space-y-4">
            <SectionTitle n="05">Динаміка</SectionTitle>
            <DailyChart buckets={data.buckets} weekly={data.weekly} />
            <div className="grid gap-4 lg:grid-cols-2 items-start">
              <HourProfile profile={data.profile} />
              <OutageCalendar days={data.days} today={today} />
            </div>
          </section>

          <section>
            <SectionTitle n="06">По годинах</SectionTitle>
            <DayTimeline days={data.days} now={now} />
          </section>

          <section>
            <SectionTitle n="07">Журнал</SectionTitle>
            <OutageList outages={data.summary.outages} />
          </section>
        </main>
      )}

      <footer className="mt-10 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-slate-500">
        <span>
          Джерело: Telegram-канал{' '}
          <a className="underline underline-offset-2 hover:text-slate-900" href={`https://t.me/${CHANNEL}`} target="_blank" rel="noreferrer">
            @{CHANNEL}
          </a>
        </span>
        {loadedAt && <span>· Дані завантажено о {fmtTime(loadedAt)}</span>}
        <button
          type="button"
          onClick={reload}
          disabled={loading}
          className="inline-flex items-center gap-1 hover:text-slate-900 disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Оновити
        </button>
      </footer>
    </div>
  );
}

function SectionTitle({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <h2 className="section-title">
      <span className="section-number">{n}</span>
      {children}
    </h2>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-label="Завантаження">
      <div className="card h-56" />
      <div className="card h-40" />
      <div className="card h-80" />
    </div>
  );
}
