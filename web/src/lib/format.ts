import { HOUR, TZ, startOfDay } from './time.ts';

const timeFmt = new Intl.DateTimeFormat('uk-UA', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
const dateFmt = new Intl.DateTimeFormat('uk-UA', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' });
const shortDateFmt = new Intl.DateTimeFormat('uk-UA', { timeZone: TZ, day: 'numeric', month: 'short' });
const monthFmt = new Intl.DateTimeFormat('uk-UA', { timeZone: TZ, month: 'long', year: 'numeric' });

/** Noon of a day key: safe instant for formatting the day itself */
const noon = (key: string) => startOfDay(key) + 12 * HOUR;

export const fmtTime = (ts: number) => timeFmt.format(ts);
export const fmtDate = (ts: number) => dateFmt.format(ts);
export const fmtDayKey = (key: string) => dateFmt.format(noon(key));
export const fmtDayShort = (key: string) => shortDateFmt.format(noon(key)).replace('.', '');
export const fmtMonth = (key: string) => monthFmt.format(noon(key)).replace(/\s*р\.?$/, '');

/** "2 год 55 хв", "43 хв", "3 д 4 год" */
export function fmtDuration(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60_000));
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return h > 0 ? `${d} д ${h} год` : `${d} д`;
  if (h > 0) return m > 0 ? `${h} год ${m} хв` : `${h} год`;
  return `${m} хв`;
}

/** "2:55" style clock duration */
export function fmtClock(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60_000));
  return `${Math.floor(totalMin / 60)}:${String(totalMin % 60).padStart(2, '0')}`;
}

export function fmtHours(h: number): string {
  return h >= 10 ? `${Math.round(h)} год` : `${h.toFixed(1).replace('.', ',')} год`;
}

export function fmtPercent(share: number): string {
  const p = share * 100;
  const precise = p < 10 || (p > 99 && p < 100);
  return (precise ? p.toFixed(1) : String(Math.round(p))).replace('.', ',') + '%';
}

export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
