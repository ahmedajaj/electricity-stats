import { useState } from 'react';
import { ChartLine, ChevronDown, MoveRight, Radio, TrendingDown, TrendingUp } from 'lucide-react';
import type { AreaStat, AreaStats as AreaStatsData } from '../hooks/useAreaStats.ts';
import type { Period } from '../lib/stats.ts';
import { fmtTime, plural } from '../lib/format.ts';
import { useAreaHistory } from '../hooks/useAreaHistory.ts';
import { TYPICAL_DAYS, compareWithPast, type Comparison } from '../lib/areaTrend.ts';
import { AreaHistoryChart } from './AreaHistoryChart.tsx';

const SUBTITLES: Record<string, string> = {
  patriotyka: 'Русової, Гмирі та Ващенка',
  osokorky: 'Позняки та Осокорки південніше проспекту Бажана',
  kyiv: 'Усе місто, без передмість',
};

function tone(share: number) {
  if (share >= 0.7) return 'text-emerald-600';
  if (share >= 0.4) return 'text-amber-600';
  return 'text-rose-600';
}

/** Live share of svitlobot.in.ua points with power: our complex, our area and the whole city */
export function AreaStats({ stats, error, periods }: { stats: AreaStatsData | null; error: string | null; periods: Period[] }) {
  const [showHistory, setShowHistory] = useState(false);
  const { history } = useAreaHistory(1 + TYPICAL_DAYS);

  if (!stats) {
    return error ? (
      <div className="card text-sm text-slate-600">Не вдалося завантажити дані svitlobot.in.ua</div>
    ) : (
      <div className="card h-28 animate-pulse" aria-label="Завантаження" />
    );
  }

  return (
    <div className="card py-4 md:py-5">
      <div className="grid gap-3 md:grid-cols-3">
        {stats.areas.map(a => (
          <AreaRow key={a.id} area={a} updatedAt={stats.updatedAt} comparison={a.id === 'kyiv' && history ? compareWithPast(history, a.id, stats.updatedAt) : null} />
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mt-3 text-xs text-slate-500">
        <button
          type="button"
          aria-expanded={showHistory}
          onClick={() => setShowHistory(v => !v)}
          className="flex items-center gap-1.5 font-medium text-slate-700 hover:text-slate-900"
        >
          <ChartLine className="w-3.5 h-3.5" />
          Історія
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
        </button>
        <span className="flex items-center gap-1.5">
          <Radio className="w-3.5 h-3.5 text-emerald-500" />
          Частка точок зі світлом ·{' '}
          <a className="underline underline-offset-2 hover:text-slate-900" href="https://svitlobot.in.ua/map" target="_blank" rel="noreferrer">
            svitlobot.in.ua
          </a>{' '}
          · {fmtTime(stats.updatedAt)}
        </span>
      </div>
      {showHistory && (
        <div className="inset p-3 md:p-4 mt-3">
          <AreaHistoryChart areas={stats.areas} periods={periods} />
        </div>
      )}
    </div>
  );
}

function AreaRow({ area, updatedAt, comparison }: { area: AreaStat; updatedAt: number; comparison: Comparison | null }) {
  const share = area.onShare;

  return (
    <div className="inset px-4 py-3.5">
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900 leading-tight">{area.name}</div>
          <div className="text-xs text-slate-500 mt-0.5">{SUBTITLES[area.id]}</div>
        </div>
        <span className={`text-3xl font-bold tracking-tight leading-none shrink-0 ${share == null ? 'text-slate-400' : tone(share)}`}>
          {share == null ? '—' : `${Math.round(share * 100)}%`}
        </span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden bg-slate-200">
        {share != null && (
          <>
            <div className="bg-[var(--color-on)] transition-all duration-700" style={{ width: `${share * 100}%` }} />
            <div className="bg-[var(--color-off)] flex-1" />
          </>
        )}
      </div>
      {share != null && (
        <div className="flex justify-between mt-1.5 text-xs">
          <span className="flex items-center gap-1.5 text-emerald-700">
            <span className="w-2 h-2 rounded-full bg-[var(--color-on)]" /> зі світлом
          </span>
          <span className="flex items-center gap-1.5 text-rose-700">
            без світла {100 - Math.round(share * 100)}% <span className="w-2 h-2 rounded-full bg-[var(--color-off)]" />
          </span>
        </div>
      )}
      {share != null && comparison && <PastComparison share={share} c={comparison} at={updatedAt} />}
    </div>
  );
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** Differences of up to 3 percentage points count as "the same" */
function trend(from: number, to: number): 'up' | 'down' | 'same' {
  const d = Math.round((to - from) * 100);
  return Math.abs(d) <= 3 ? 'same' : d > 0 ? 'up' : 'down';
}

const TREND_STYLE = {
  up: { Icon: TrendingUp, cls: 'text-emerald-700' },
  down: { Icon: TrendingDown, cls: 'text-rose-700' },
  same: { Icon: MoveRight, cls: 'text-slate-600' },
};

function Verdict({ dir, title, detail, hint }: { dir: 'up' | 'down' | 'same'; title: string; detail: string; hint?: string }) {
  const { Icon, cls } = TREND_STYLE[dir];
  return (
    <div className="flex items-start gap-2" title={hint}>
      <Icon className={`w-4 h-4 shrink-0 mt-px ${cls}`} />
      <div className="min-w-0">
        <div className={`text-xs font-semibold ${cls}`}>{title}</div>
        <div className="text-xs text-slate-500">{detail}</div>
      </div>
    </div>
  );
}

/**
 * Plain-language trend. Yesterday alone misleads (outage queues rotate day to day), so "now" is compared
 * with the same time of day averaged over the last week, and the last 24 h with the 24 h before.
 */
function PastComparison({ share, c, at }: { share: number; c: Comparison; at: number }) {
  if (!c.typical && (c.last24 == null || c.prev24 == null)) return null;
  const now = c.typical ? trend(c.typical.value, share) : null;
  const day = c.last24 != null && c.prev24 != null ? trend(c.prev24, c.last24) : null;
  return (
    <div className="space-y-2 mt-2.5 pt-2.5 border-t border-slate-200">
      {c.typical && now && (
        <Verdict
          dir={now}
          title={{ up: 'Зараз краще, ніж за тиждень у цей час', down: 'Зараз гірше, ніж за тиждень у цей час', same: 'Зараз як за тиждень у цей час' }[now]}
          detail={`${pct(share)} зі світлом · у середньому за ${c.typical.days} ${plural(c.typical.days, 'день', 'дні', 'днів')} о ${fmtTime(at)} — ${pct(c.typical.value)}`}
          hint={c.yesterday != null ? `Вчора о цій порі: ${pct(c.yesterday)}` : undefined}
        />
      )}
      {day && c.last24 != null && c.prev24 != null && (
        <Verdict
          dir={day}
          title={{ up: 'Остання доба краща за попередню', down: 'Остання доба гірша за попередню', same: 'Доба така сама, як попередня' }[day]}
          detail={`у середньому ${pct(c.last24)} зі світлом проти ${pct(c.prev24)}`}
          hint="Середня частка точок зі світлом за останні 24 години проти попередніх 24 годин"
        />
      )}
    </div>
  );
}
