import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TooltipContentProps } from 'recharts';
import { Clock3 } from 'lucide-react';
import { AXIS, GRID, OFF, TICK } from '../lib/colors.ts';

/** Share of time without power for each hour of the day */
export function HourProfile({ profile }: { profile: number[] }) {
  const data = profile.map((share, h) => ({ hour: h, label: String(h).padStart(2, '0'), pct: Math.round(share * 100) }));
  const max = Math.max(...data.map(d => d.pct), 1);
  const worst = data.reduce((a, b) => (b.pct > a.pct ? b : a), data[0]);

  const renderTooltip = ({ active, payload }: TooltipContentProps) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload as (typeof data)[number];
    return (
      <div className="bg-white/95 backdrop-blur ring-1 ring-slate-200 rounded-xl px-3.5 py-2.5 shadow-lg text-sm">
        <p className="font-mono font-semibold text-slate-900">
          {d.label}:00–{String((d.hour + 1) % 24).padStart(2, '0')}:00
        </p>
        <p className="text-rose-700">
          без світла <span className="font-mono font-semibold">{d.pct}%</span> часу
        </p>
      </div>
    );
  };

  return (
    <div className="card h-full">
      <div className="card-head">
        <div className="card-icon">
          <Clock3 />
        </div>
        <div>
          <h2 className="card-title">Коли вимикають</h2>
          <p className="card-sub">
            {worst.pct > 0 ? (
              <>
                Найчастіше о <span className="font-mono font-semibold text-slate-900">{worst.label}:00</span> — {worst.pct}% часу без світла
              </>
            ) : (
              'Відключень за період не було'
            )}
          </p>
        </div>
      </div>
      <div className="h-52 -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap="12%">
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis dataKey="label" stroke={AXIS} tick={{ fill: TICK, fontSize: 11 }} tickLine={false} interval={2} />
            <YAxis stroke={AXIS} tick={{ fill: TICK, fontSize: 11 }} tickLine={false} width={36} tickFormatter={v => `${v}%`} />
            <Tooltip content={renderTooltip} cursor={{ fill: 'oklch(95.8% 0.005 250 / 0.7)' }} />
            <Bar dataKey="pct" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {data.map(d => (
                <Cell key={d.hour} fill={OFF} fillOpacity={0.25 + 0.75 * (d.pct / max)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
