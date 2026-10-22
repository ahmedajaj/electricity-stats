import type React from 'react';
import { Hourglass, Sun, Timer, TriangleAlert, ZapOff } from 'lucide-react';
import type { RangeSummary } from '../lib/stats.ts';
import { fmtDate, fmtDuration, fmtPercent } from '../lib/format.ts';

export function SummaryTiles({ summary }: { summary: RangeSummary }) {
  const { onMs, offMs, onShare, outages, avgOutage, longestOutage } = summary;
  const known = onMs + offMs;

  return (
    <div>
      {/* On/off ratio bar */}
      <div className="flex items-center justify-between text-[13px] font-medium mb-2">
        <span className="flex items-center gap-1.5 text-emerald-700">
          <span className="w-2.5 h-2.5 rounded-sm bg-[var(--color-on)]" /> Зі світлом {fmtPercent(onShare)}
        </span>
        <span className="flex items-center gap-1.5 text-rose-700">
          Без світла {fmtPercent(known ? offMs / known : 0)} <span className="w-2.5 h-2.5 rounded-sm bg-[var(--color-off)]" />
        </span>
      </div>
      <div className="flex h-3 rounded-full overflow-hidden bg-slate-100 mb-5">
        <div className="bg-[var(--color-on)] transition-all duration-700" style={{ width: `${onShare * 100}%` }} />
        <div className="bg-[var(--color-off)] transition-all duration-700 flex-1" style={{ opacity: known ? 1 : 0 }} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 md:gap-3">
        <Tile icon={<Sun />} tone="emerald" label="Зі світлом" value={fmtDuration(onMs)} />
        <Tile icon={<ZapOff />} tone="rose" label="Без світла" value={fmtDuration(offMs)} />
        <Tile
          icon={<TriangleAlert />}
          tone="amber"
          label="Відключень"
          value={String(outages.length)}
        />
        <Tile icon={<Timer />} tone="sky" label="Середнє" value={outages.length ? fmtDuration(avgOutage) : '—'} />
        <Tile
          icon={<Hourglass />}
          tone="violet"
          label="Найдовше"
          value={longestOutage ? fmtDuration(longestOutage.duration) : '—'}
          hint={longestOutage ? fmtDate(longestOutage.start) : undefined}
          className="col-span-2 md:col-span-1"
        />
      </div>
    </div>
  );
}

const TONES = {
  emerald: 'bg-emerald-100 text-emerald-700',
  rose: 'bg-rose-100 text-rose-600',
  amber: 'bg-amber-100 text-amber-700',
  sky: 'bg-sky-100 text-sky-600',
  violet: 'bg-violet-100 text-violet-600',
} as const;

export function Tile({
  icon,
  tone,
  label,
  value,
  hint,
  className = '',
  wrap = false,
}: {
  icon: React.ReactElement;
  tone: keyof typeof TONES;
  label: string;
  value: string;
  hint?: string;
  className?: string;
  /** Let long labels wrap instead of truncating */
  wrap?: boolean;
}) {
  return (
    <div className={`inset px-3.5 py-3 md:px-4 md:py-3.5 ${className}`}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className={`grid place-items-center w-6 h-6 rounded-lg shrink-0 [&>svg]:w-3.5 [&>svg]:h-3.5 ${TONES[tone]}`}>{icon}</span>
        <span className={`text-xs text-slate-600 font-medium ${wrap ? 'leading-tight' : 'truncate'}`}>{label}</span>
      </div>
      <div className="text-base md:text-lg font-semibold tracking-tight text-slate-900 truncate">{value}</div>
      {hint && <div className={`text-[11px] text-slate-500 first-letter:uppercase ${wrap ? 'leading-snug mt-0.5' : 'truncate'}`}>{hint}</div>}
    </div>
  );
}
