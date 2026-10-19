import { Radio } from 'lucide-react';
import type { AreaStat, AreaStats as AreaStatsData } from '../hooks/useAreaStats.ts';
import { fmtTime } from '../lib/format.ts';

const SUBTITLES: Record<string, string> = {
  osokorky: 'Позняки та Осокорки південніше проспекту Бажана',
  kyiv: 'Усе місто, без передмість',
};

function tone(share: number) {
  if (share >= 0.7) return 'text-emerald-600';
  if (share >= 0.4) return 'text-amber-600';
  return 'text-rose-600';
}

/** Live share of svitlobot.in.ua points with power: our area vs the whole city */
export function AreaStats({ stats, error }: { stats: AreaStatsData | null; error: string | null }) {
  if (!stats) {
    return error ? (
      <div className="card text-sm text-slate-600">Не вдалося завантажити дані svitlobot.in.ua</div>
    ) : (
      <div className="card h-28 animate-pulse" aria-label="Завантаження" />
    );
  }

  return (
    <div className="card py-4 md:py-5">
      <div className="grid gap-3 sm:grid-cols-2">
        {stats.areas.map(a => (
          <AreaRow key={a.id} area={a} />
        ))}
      </div>
      <div className="flex items-center justify-end gap-1.5 mt-3 text-xs text-slate-500">
        <Radio className="w-3.5 h-3.5 text-emerald-500" />
        Частка точок зі світлом ·{' '}
        <a className="underline underline-offset-2 hover:text-slate-900" href="https://svitlobot.in.ua/map" target="_blank" rel="noreferrer">
          svitlobot.in.ua
        </a>{' '}
        · {fmtTime(stats.updatedAt)}
      </div>
    </div>
  );
}

function AreaRow({ area }: { area: AreaStat }) {
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
    </div>
  );
}
