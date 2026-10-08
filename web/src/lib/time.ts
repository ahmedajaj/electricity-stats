// Kyiv-local calendar helpers. All timestamps are epoch ms; days are 'YYYY-MM-DD'
// keys in Europe/Kyiv, so DST days (23h / 25h) are handled correctly.

export const TZ = 'Europe/Kyiv';
export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;

const partsFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

interface Parts { y: number; m: number; d: number; h: number; mi: number; s: number }

function kyivParts(ts: number): Parts {
  const p: Record<string, number> = {};
  for (const { type, value } of partsFmt.formatToParts(ts)) {
    if (type !== 'literal') p[type] = Number(value);
  }
  return { y: p.year, m: p.month, d: p.day, h: p.hour, mi: p.minute, s: p.second };
}

/** Kyiv UTC offset at the given instant, in ms (e.g. +3h in summer) */
function tzOffset(ts: number): number {
  const p = kyivParts(ts);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s);
  return asUtc - Math.floor(ts / 1000) * 1000;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function dayKey(ts: number): string {
  const p = kyivParts(ts);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

/** Kyiv hour of day (0–23) */
export function kyivHour(ts: number): number {
  return kyivParts(ts).h;
}

/** Epoch ms of Kyiv midnight that starts the given day */
export function startOfDay(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d);
  const off = tzOffset(guess);
  const t = guess - off;
  const off2 = tzOffset(t);
  return off2 === off ? t : guess - off2;
}

export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** [start, end) of a Kyiv day in epoch ms */
export function dayBounds(key: string): [number, number] {
  return [startOfDay(key), startOfDay(addDays(key, 1))];
}

/** Inclusive list of day keys */
export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  for (let k = from; k <= to; k = addDays(k, 1)) out.push(k);
  return out;
}

/** 0 = Monday … 6 = Sunday */
export function weekday(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export function daysBetween(from: string, to: string): number {
  const a = from.split('-').map(Number);
  const b = to.split('-').map(Number);
  return Math.round((Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2])) / DAY);
}
