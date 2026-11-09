import type { AreaHistory } from '../hooks/useAreaHistory.ts';
import { DAY } from './time.ts';

// Samples come every 5 minutes, so a full day has ~288 of them
const SAMPLE_MS = 5 * 60_000;
// "Same time of day" means samples within ±15 minutes
const SAME_TIME_MS = 15 * 60_000;
export const TYPICAL_DAYS = 7;

/** One area's samples, oldest first, with prefix sums for fast window means */
export interface Series {
  t: number[];
  v: number[];
  prefix: number[];
}

export function seriesOf(history: AreaHistory, id: string): Series | null {
  const col = history.ids.indexOf(id) + 1;
  if (col === 0) return null;
  const t: number[] = [];
  const v: number[] = [];
  const prefix = [0];
  for (const r of history.rows) {
    const share = r[col];
    if (share == null) continue;
    t.push(r[0] as number);
    v.push(share);
    prefix.push(prefix[prefix.length - 1] + share);
  }
  return { t, v, prefix };
}

function lowerBound(arr: number[], x: number) {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Mean share in [from, to); null unless at least `minCoverage` of the expected samples exist */
export function windowMean(s: Series, from: number, to: number, minCoverage = 0): number | null {
  const i = lowerBound(s.t, from);
  const j = lowerBound(s.t, to);
  const n = j - i;
  if (n === 0 || n < minCoverage * ((to - from) / SAMPLE_MS)) return null;
  return (s.prefix[j] - s.prefix[i]) / n;
}

/** Share around the same time of day `daysAgo` days before `t` */
export function sameTimeAgo(s: Series, t: number, daysAgo: number): number | null {
  const at = t - daysAgo * DAY;
  return windowMean(s, at - SAME_TIME_MS, at + SAME_TIME_MS);
}

/** Average of the same time of day over the previous `TYPICAL_DAYS` days (days without data are skipped) */
export function typicalAt(s: Series, t: number): { value: number; days: number } | null {
  let sum = 0;
  let days = 0;
  for (let k = 1; k <= TYPICAL_DAYS; k++) {
    const v = sameTimeAgo(s, t, k);
    if (v == null) continue;
    sum += v;
    days += 1;
  }
  return days ? { value: sum / days, days } : null;
}

/** Mean over the 24 hours before `t`; needs at least half a day of samples */
export function dayMean(s: Series, t: number): number | null {
  return windowMean(s, t - DAY, t, 0.5);
}

export interface Comparison {
  typical: { value: number; days: number } | null;
  yesterday: number | null;
  last24: number | null;
  prev24: number | null;
}

/** How the current share compares with the usual level, yesterday and the previous day */
export function compareWithPast(history: AreaHistory, id: string, now: number): Comparison | null {
  const s = seriesOf(history, id);
  if (!s || s.t.length === 0) return null;
  return {
    typical: typicalAt(s, now),
    yesterday: sameTimeAgo(s, now, 1),
    last24: dayMean(s, now),
    prev24: dayMean(s, now - DAY),
  };
}
