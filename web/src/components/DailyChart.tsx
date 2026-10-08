import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TooltipContentProps } from 'recharts';
import { BarChart3 } from 'lucide-react';
import type { Bucket } from '../lib/stats.ts';
import { addDays } from '../lib/time.ts';
import { fmtDayKey, fmtDayShort, fmtHours, plural } from '../lib/format.ts';
import { AXIS, GRID, OFF, ON, TICK } from '../lib/colors.ts';

type View = 'both' | 'off';

interface Props {
  buckets: Bucket[];
  weekly: boolean;
}

export function DailyChart({ buckets, weekly }: Props) {
  const [view, setView] = useState<View>('both');

  const data = buckets.map(b => ({
    ...b,
    label: fmtDayShort(b.key),
  }));

  const renderTooltip = ({ active, payload }: TooltipContentProps) => {
    if (!active || !payload?.length) return null;
    const b = payload[0].payload as Bucket;
    const title = weekly ? `${fmtDayShort(b.key)} – ${fmtDayShort(addDays(b.key, 6))}` : fmtDayKey(b.key);
    return (
      <div className="bg-white/95 backdrop-blur ring-1 ring-slate-200 rounded-xl p-3.5 shadow-lg">
        <p className="text-slate-900 font-semibold mb-2 first-letter:uppercase">{title}</p>
        <div className="space-y-1 text-sm">
          <p className="text-rose-700">
            Без світла: <span className="font-mono font-semibold">{fmtHours(b.offHours)}</span>
          </p>
          <p className="text-emerald-700">
            Зі світлом: <span className="font-mono font-semibold">{fmtHours(b.onHours)}</span>
          </p>
          <p className="text-slate-600 text-xs pt-1">
            {b.outages} {plural(b.outages, 'відключення', 'відключення', 'відключень')}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="card">
      <div className="card-head justify-between flex-wrap">
        <div className="flex items-center gap-3">
          <div className="card-icon">
            <BarChart3 />
          </div>
          <div>
            <h2 className="card-title">{weekly ? 'По тижнях' : 'По днях'}</h2>
            <p className="card-sub">Години зі світлом і без нього{weekly ? ' за кожен тиждень' : ''}</p>
          </div>
        </div>
        <div className="seg w-full sm:w-auto" role="group" aria-label="Що показувати">
          <button type="button" className="seg-btn" aria-pressed={view === 'both'} onClick={() => setView('both')}>
            Усе
          </button>
          <button type="button" className="seg-btn" aria-pressed={view === 'off'} onClick={() => setView('off')}>
            Лише відключення
          </button>
        </div>
      </div>

      <div className="h-64 md:h-72 -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap="18%">
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis dataKey="label" stroke={AXIS} tick={{ fill: TICK, fontSize: 11 }} tickLine={false} minTickGap={12} />
            <YAxis
              stroke={AXIS}
              tick={{ fill: TICK, fontSize: 11 }}
              tickLine={false}
              width={36}
              domain={view === 'both' ? [0, weekly ? 168 : 24] : [0, 'auto']}
              ticks={view === 'both' ? (weekly ? [0, 42, 84, 126, 168] : [0, 6, 12, 18, 24]) : undefined}
              tickFormatter={v => `${v}г`}
            />
            <Tooltip content={renderTooltip} cursor={{ fill: 'oklch(95.8% 0.005 250 / 0.7)' }} />
            <Bar dataKey="offHours" stackId="h" fill={OFF} radius={view === 'off' ? [4, 4, 0, 0] : 0} isAnimationActive={false} />
            {view === 'both' && <Bar dataKey="onHours" stackId="h" fill={ON} radius={[4, 4, 0, 0]} isAnimationActive={false} />}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
