import { CalendarRange } from 'lucide-react';

export type Preset = '7' | '14' | '30' | 'all' | 'custom';

export interface Range {
  preset: Preset;
  from: string;
  to: string;
}

const PRESETS: { id: Preset; label: string }[] = [
  { id: '7', label: '7 днів' },
  { id: '14', label: '14 днів' },
  { id: '30', label: '30 днів' },
  { id: 'all', label: 'Увесь час' },
];

interface Props {
  range: Range;
  min: string;
  max: string;
  onPreset: (p: Preset) => void;
  onCustom: (from: string, to: string) => void;
}

export function PeriodPicker({ range, min, max, onPreset, onCustom }: Props) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center gap-3">
      <div className="seg flex-1" role="group" aria-label="Період">
        {PRESETS.map(p => (
          <button key={p.id} type="button" className="seg-btn px-1.5 sm:px-3" aria-pressed={range.preset === p.id} onClick={() => onPreset(p.id)}>
            {p.label}
          </button>
        ))}
      </div>
      <div
        className={`flex items-center gap-1.5 sm:gap-2 rounded-xl p-1 sm:pl-3 ring-1 ring-inset transition-colors ${
          range.preset === 'custom' ? 'bg-white ring-slate-900/20 shadow-sm' : 'bg-slate-100 ring-slate-200'
        }`}
      >
        <CalendarRange className="hidden sm:block w-4 h-4 text-slate-500 shrink-0" />
        <input
          type="date"
          aria-label="Початкова дата"
          className="input h-9 min-w-0 flex-1 px-2 sm:px-3 text-[13px] sm:text-sm lg:w-[9.5rem]"
          value={range.from}
          min={min}
          max={range.to}
          onChange={e => e.target.value && onCustom(e.target.value, range.to)}
        />
        <span className="text-slate-400">–</span>
        <input
          type="date"
          aria-label="Кінцева дата"
          className="input h-9 min-w-0 flex-1 px-2 sm:px-3 text-[13px] sm:text-sm lg:w-[9.5rem]"
          value={range.to}
          min={range.from}
          max={max}
          onChange={e => e.target.value && onCustom(range.from, e.target.value)}
        />
      </div>
    </div>
  );
}
