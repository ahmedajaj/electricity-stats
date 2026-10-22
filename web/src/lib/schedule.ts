// Planned outage schedule (ЯСНО) vs actual outages.
//
// The archive holds every revision of a day's schedule as it was collected.
// A revision is in force from when it was published (updatedOn, or when we first
// saw it) until the next revision, so mid-day changes are compared fairly.
// Statuses other than "ScheduleApplies" (emergency outages, schedule not
// published) mean there is no plan to compare against for that stretch.

import type { Period, Status } from './stats.ts';
import { atKyivMinute, dayBounds } from './time.ts';

export interface Slot {
  start: number;
  end: number;
  type: string;
}

export interface Revision {
  fetchedAt: string;
  updatedOn: string | null;
  status: string;
  slots: Slot[];
}

export interface ScheduleArchive {
  group: string;
  days: Record<string, Revision[]>;
}

/** off = planned outage, on = no outage planned, maybe = possible outage, none = no schedule in force */
export type PlanKind = 'off' | 'on' | 'maybe' | 'none';

export interface PlanSegment {
  start: number;
  end: number;
  kind: PlanKind;
  /** Yasno status for "none" segments, e.g. EmergencyShutdowns */
  status?: string;
}

export const SCHEDULE_APPLIES = 'ScheduleApplies';

function slotKind(type: string): PlanKind {
  if (type === 'Definite') return 'off';
  if (type === 'NotPlanned') return 'on';
  return 'maybe';
}

/** When a revision started to apply: its publish time, unless we saw it earlier than that */
function validFrom(rev: Revision): number {
  const fetched = Date.parse(rev.fetchedAt);
  const updated = rev.updatedOn ? Date.parse(rev.updatedOn) : NaN;
  return Number.isFinite(updated) && updated <= fetched ? updated : fetched;
}

/** The plan as it was in force through the day, covering the whole day */
export function effectivePlan(key: string, revisions: Revision[] | undefined): PlanSegment[] {
  const [dayStart, dayEnd] = dayBounds(key);
  if (!revisions?.length) return [{ start: dayStart, end: dayEnd, kind: 'none', status: 'Unknown' }];

  const out: PlanSegment[] = [];
  let from = Math.max(validFrom(revisions[0]), dayStart);
  if (from > dayStart) out.push({ start: dayStart, end: from, kind: 'none', status: 'Unknown' });

  revisions.forEach((rev, i) => {
    const next = i + 1 < revisions.length ? Math.max(validFrom(revisions[i + 1]), from) : dayEnd;
    const to = Math.min(next, dayEnd);
    if (to <= from) return;

    if (rev.status !== SCHEDULE_APPLIES) {
      out.push({ start: from, end: to, kind: 'none', status: rev.status });
    } else {
      for (const slot of rev.slots) {
        const s = Math.max(atKyivMinute(key, slot.start), from);
        const e = Math.min(atKyivMinute(key, slot.end), to);
        if (e > s) out.push({ start: s, end: e, kind: slotKind(slot.type) });
      }
    }
    from = to;
  });

  return merge(out);
}

/** The latest published plan for a day (what Yasno shows right now), ignoring history */
export function latestPlan(key: string, revisions: Revision[] | undefined): { plan: PlanSegment[]; status: string | null } {
  const rev = revisions?.[revisions.length - 1];
  if (!rev) return { plan: [], status: null };
  const [dayStart, dayEnd] = dayBounds(key);
  if (rev.status !== SCHEDULE_APPLIES) return { plan: [{ start: dayStart, end: dayEnd, kind: 'none', status: rev.status }], status: rev.status };
  const plan = rev.slots
    .map(s => ({ start: atKyivMinute(key, s.start), end: atKyivMinute(key, s.end), kind: slotKind(s.type) }))
    .filter(s => s.end > s.start);
  return { plan: merge(plan), status: rev.status };
}

function merge(segments: PlanSegment[]): PlanSegment[] {
  const out: PlanSegment[] = [];
  for (const s of segments) {
    const last = out[out.length - 1];
    if (last && last.kind === s.kind && last.status === s.status && last.end === s.start) last.end = s.end;
    else out.push({ ...s });
  }
  return out;
}

export interface DayComparison {
  key: string;
  plan: PlanSegment[];
  revisions: number;
  /** Any part of the day without a schedule in force (emergency etc.) */
  statuses: string[];
  plannedOffMs: number;
  actualOffMs: number;
  /** Time where plan and reality agree, among comparable time */
  matchMs: number;
  /** Time with a plan in force (on/off) and known actual status */
  comparableMs: number;
  /** No power although no outage was planned */
  unplannedOffMs: number;
  /** Power was on during a planned outage */
  spareOnMs: number;
}

/** Minute-accurate overlap of plan and actual periods within [from, to) */
export function compareDay(key: string, revisions: Revision[] | undefined, periods: Period[], now: number): DayComparison {
  const [dayStart, dayEnd] = dayBounds(key);
  const to = Math.min(dayEnd, now);
  const plan = effectivePlan(key, revisions);
  const result: DayComparison = {
    key,
    plan,
    revisions: revisions?.length ?? 0,
    statuses: [...new Set((revisions ?? []).map(r => r.status).filter(s => s !== SCHEDULE_APPLIES))],
    plannedOffMs: 0,
    actualOffMs: 0,
    matchMs: 0,
    comparableMs: 0,
    unplannedOffMs: 0,
    spareOnMs: 0,
  };
  if (to <= dayStart) return result;

  for (const seg of plan) {
    const s0 = Math.max(seg.start, dayStart);
    const s1 = Math.min(seg.end, to);
    if (s1 <= s0) continue;
    if (seg.kind === 'off') result.plannedOffMs += s1 - s0;

    for (const p of periods) {
      const a = Math.max(s0, p.start);
      const b = Math.min(s1, p.end);
      if (b <= a) continue;
      const ms = b - a;
      const actual: Status = p.status;
      if (actual === 'off') result.actualOffMs += ms;
      if (seg.kind !== 'on' && seg.kind !== 'off') continue;
      result.comparableMs += ms;
      if ((seg.kind === 'off') === (actual === 'off')) result.matchMs += ms;
      else if (actual === 'off') result.unplannedOffMs += ms;
      else result.spareOnMs += ms;
    }
  }
  return result;
}

export interface ComparisonSummary {
  days: number;
  matchShare: number | null;
  plannedOffMs: number;
  actualOffMs: number;
  unplannedOffMs: number;
  spareOnMs: number;
  /** Revisions beyond the first per day */
  changes: number;
  daysWithoutSchedule: number;
}

export function summarizeComparisons(days: DayComparison[]): ComparisonSummary {
  const sum = (f: (d: DayComparison) => number) => days.reduce((s, d) => s + f(d), 0);
  const comparable = sum(d => d.comparableMs);
  return {
    days: days.length,
    matchShare: comparable > 0 ? sum(d => d.matchMs) / comparable : null,
    plannedOffMs: sum(d => d.plannedOffMs),
    actualOffMs: sum(d => d.actualOffMs),
    unplannedOffMs: sum(d => d.unplannedOffMs),
    spareOnMs: sum(d => d.spareOnMs),
    changes: sum(d => Math.max(0, d.revisions - 1)),
    daysWithoutSchedule: days.filter(d => d.statuses.length > 0).length,
  };
}
