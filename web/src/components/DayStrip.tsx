import type { Period } from '../lib/stats.ts';
import { fmtDuration, fmtTime } from '../lib/format.ts';

interface Props {
  start: number;
  end: number;
  periods: Period[];
  /** Draws a "now" marker when it falls inside the day */
  now?: number;
  height?: string;
}

/** One day as a horizontal on/off bar; unknown time is hatched */
export function DayStrip({ start, end, periods, now, height = 'h-3' }: Props) {
  const len = end - start;
  const pct = (t: number) => `${((t - start) / len) * 100}%`;
  const showNow = now !== undefined && now > start && now < end;

  return (
    <div className={`relative ${height} rounded-md overflow-hidden strip-empty`}>
      {periods.map(p => (
        <div
          key={p.start}
          className="absolute inset-y-0"
          style={{
            left: pct(p.start),
            width: `${((p.end - p.start) / len) * 100}%`,
            backgroundColor: p.status === 'on' ? 'var(--color-on)' : 'var(--color-off)',
          }}
          title={`${p.status === 'on' ? 'Є світло' : 'Немає світла'} · ${fmtTime(p.start)}–${fmtTime(p.end)} · ${fmtDuration(p.end - p.start)}`}
        />
      ))}
      {showNow && (
        <div className="absolute inset-y-0 w-0.5 bg-slate-900 rounded-full" style={{ left: pct(now) }} />
      )}
    </div>
  );
}

export function HourTicks({ every = 3 }: { every?: number }) {
  const ticks = Array.from({ length: 24 / every + 1 }, (_, i) => i * every);
  return (
    <div className="relative h-4 text-[10px] font-mono text-slate-400">
      {ticks.map(h => (
        <span
          key={h}
          className="absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full"
          style={{ left: `${(h / 24) * 100}%` }}
        >
          {String(h).padStart(2, '0')}
        </span>
      ))}
    </div>
  );
}
