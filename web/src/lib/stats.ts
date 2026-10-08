import { HOUR, addDays, dayBounds, dayKey, eachDay, kyivHour, weekday } from './time.ts';

export type Status = 'on' | 'off';

export interface RawEvent {
  date: string;
  status: Status;
}

export interface Period {
  start: number;
  end: number;
  status: Status;
}

export interface Outage {
  start: number;
  end: number;
  duration: number;
  ongoing: boolean;
}

export interface DayStats {
  key: string;
  start: number;
  end: number;
  onMs: number;
  offMs: number;
  /** Periods clipped to this day */
  periods: Period[];
  outages: number;
}

export interface RangeSummary {
  onMs: number;
  offMs: number;
  /** Share of known time with power, 0–1 */
  onShare: number;
  outages: Outage[];
  avgOutage: number;
  longestOutage: Outage | null;
}

/** Sorted status changes; repeated messages with the same status are collapsed */
export function normalize(raw: RawEvent[]): { t: number; status: Status }[] {
  const sorted = raw
    .map(e => ({ t: Date.parse(e.date), status: e.status }))
    .filter(e => Number.isFinite(e.t))
    .sort((a, b) => a.t - b.t);

  const out: typeof sorted = [];
  for (const e of sorted) {
    if (out.length === 0 || out[out.length - 1].status !== e.status) out.push(e);
  }
  return out;
}

/** Continuous on/off periods; the last one runs until `now` */
export function buildPeriods(raw: RawEvent[], now: number): Period[] {
  const events = normalize(raw);
  const periods: Period[] = [];
  events.forEach((e, i) => {
    const end = i + 1 < events.length ? events[i + 1].t : now;
    if (end > e.t) periods.push({ start: e.t, end, status: e.status });
  });
  return periods;
}

export function clip(periods: Period[], from: number, to: number): Period[] {
  const out: Period[] = [];
  for (const p of periods) {
    if (p.end <= from || p.start >= to) continue;
    out.push({ start: Math.max(p.start, from), end: Math.min(p.end, to), status: p.status });
  }
  return out;
}

export function allOutages(periods: Period[], now: number): Outage[] {
  return periods
    .filter(p => p.status === 'off')
    .map(p => ({ start: p.start, end: p.end, duration: p.end - p.start, ongoing: p.end >= now }));
}

export function summarize(periods: Period[], outages: Outage[], from: number, to: number): RangeSummary {
  let onMs = 0;
  let offMs = 0;
  for (const p of clip(periods, from, to)) {
    if (p.status === 'on') onMs += p.end - p.start;
    else offMs += p.end - p.start;
  }
  const inRange = outages.filter(o => o.start >= from && o.start < to);
  const total = inRange.reduce((s, o) => s + o.duration, 0);
  const longest = inRange.reduce<Outage | null>((m, o) => (!m || o.duration > m.duration ? o : m), null);
  return {
    onMs,
    offMs,
    onShare: onMs + offMs > 0 ? onMs / (onMs + offMs) : 0,
    outages: inRange,
    avgOutage: inRange.length ? total / inRange.length : 0,
    longestOutage: longest,
  };
}

export function dailyStats(periods: Period[], outages: Outage[], from: string, to: string): DayStats[] {
  return eachDay(from, to).map(key => {
    const [start, end] = dayBounds(key);
    const dayPeriods = clip(periods, start, end);
    let onMs = 0;
    let offMs = 0;
    for (const p of dayPeriods) {
      if (p.status === 'on') onMs += p.end - p.start;
      else offMs += p.end - p.start;
    }
    const count = outages.filter(o => o.start >= start && o.start < end).length;
    return { key, start, end, onMs, offMs, periods: dayPeriods, outages: count };
  });
}

export interface Bucket {
  key: string;
  label: string;
  onHours: number;
  offHours: number;
  outages: number;
}

/** Daily buckets, or weekly ones (starting Monday) for long ranges */
export function bucketize(days: DayStats[], weekly: boolean): Bucket[] {
  const map = new Map<string, Bucket>();
  for (const d of days) {
    const key = weekly ? addDays(d.key, -weekday(d.key)) : d.key;
    const b = map.get(key) ?? { key, label: key, onHours: 0, offHours: 0, outages: 0 };
    b.onHours += d.onMs / HOUR;
    b.offHours += d.offMs / HOUR;
    b.outages += d.outages;
    map.set(key, b);
  }
  return [...map.values()];
}

/** For each Kyiv hour 0–23: share of known time without power */
export function hourProfile(periods: Period[], from: number, to: number): number[] {
  const off = new Array<number>(24).fill(0);
  const known = new Array<number>(24).fill(0);
  for (const p of clip(periods, from, to)) {
    let t = p.start;
    while (t < p.end) {
      // Kyiv offsets are whole hours, so UTC hour boundaries are Kyiv hour boundaries
      const next = Math.min(p.end, Math.floor(t / HOUR) * HOUR + HOUR);
      const h = kyivHour(t);
      known[h] += next - t;
      if (p.status === 'off') off[h] += next - t;
      t = next;
    }
  }
  return off.map((v, h) => (known[h] > 0 ? v / known[h] : 0));
}

export function firstEventDay(raw: RawEvent[]): string | null {
  const events = normalize(raw);
  return events.length ? dayKey(events[0].t) : null;
}
