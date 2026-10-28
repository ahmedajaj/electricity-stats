// Planned outage schedule (ДТЕК, via the Yasno API) vs actual outages.
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
  return { plan: slotsToPlan(key, rev.slots), status: rev.status };
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

/** Statuses that are not an emergency: the next day's placeholder and "we have no data" */
const NOT_EMERGENCY = new Set(['Unknown', 'WaitingForSchedule']);

export function isEmergency(status: string | undefined): boolean {
  return !!status && status !== SCHEDULE_APPLIES && !NOT_EMERGENCY.has(status);
}

function slotsToPlan(key: string, slots: Slot[]): PlanSegment[] {
  return merge(
    slots
      .map(s => ({ start: atKyivMinute(key, s.start), end: atKyivMinute(key, s.end), kind: slotKind(s.type) }))
      .filter(s => s.end > s.start),
  );
}

/**
 * Whether the plan actually in force differed from the first published schedule.
 * Placeholders before publication and a change that was reverted before it took
 * effect don't count; emergency stretches are reported separately.
 */
function planChanged(key: string, revisions: Revision[] | undefined, inForce: PlanSegment[]): boolean {
  const first = revisions?.find(r => r.status === SCHEDULE_APPLIES);
  if (!first) return false;
  const baseline = slotsToPlan(key, first.slots);
  for (const seg of inForce) {
    if (seg.kind === 'none') continue;
    for (const b of baseline) {
      if (Math.min(seg.end, b.end) > Math.max(seg.start, b.start) && seg.kind !== b.kind) return true;
    }
  }
  return false;
}

/** When each revision that changed the plan started to apply (for markers on the plan strip) */
export function changeTimes(key: string, revisions: Revision[] | undefined): number[] {
  const [start, end] = dayBounds(key);
  const out: number[] = [];
  let prev: string | null = null;
  for (const r of revisions ?? []) {
    if (r.status !== SCHEDULE_APPLIES) continue;
    const fp = JSON.stringify(r.slots.map(s => [s.start, s.end, s.type]));
    const t = validFrom(r);
    if (prev !== null && fp !== prev && t > start && t < end) out.push(t);
    prev = fp;
  }
  return out;
}

export interface DayComparison {
  key: string;
  plan: PlanSegment[];
  /** An emergency status (e.g. EmergencyShutdowns) was in force during the day */
  emergency: boolean;
  /** The plan in force differed from the first published schedule for the day */
  changed: boolean;
  plannedOffMs: number;
  actualOffMs: number;
  /** Time the plan promised power (and the actual status is known) */
  promisedOnMs: number;
  /** Time the plan had an outage (and the actual status is known) */
  plannedOffKnownMs: number;
  /** No power although no outage was planned — the bad surprise */
  unplannedOffMs: number;
  /** Power was on during a planned outage — the good surprise */
  spareOnMs: number;
}

/**
 * Minute-accurate overlap of plan and actual periods within [from, to).
 * The two kinds of mismatch are kept apart on purpose: an outage nobody planned is
 * a broken promise, while power during a planned outage is a bonus.
 */
export function compareDay(key: string, revisions: Revision[] | undefined, periods: Period[], now: number): DayComparison {
  const [dayStart, dayEnd] = dayBounds(key);
  const to = Math.min(dayEnd, now);
  const plan = effectivePlan(key, revisions);
  const result: DayComparison = {
    key,
    plan,
    emergency: plan.some(s => s.kind === 'none' && isEmergency(s.status)),
    changed: planChanged(key, revisions, plan),
    plannedOffMs: 0,
    actualOffMs: 0,
    promisedOnMs: 0,
    plannedOffKnownMs: 0,
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
      if (seg.kind === 'on') {
        result.promisedOnMs += ms;
        if (actual === 'off') result.unplannedOffMs += ms;
      } else if (seg.kind === 'off') {
        result.plannedOffKnownMs += ms;
        if (actual === 'on') result.spareOnMs += ms;
      }
    }
  }
  return result;
}

function ratio(part: number, whole: number): number | null {
  return whole > 0 ? part / whole : null;
}

function promisedShare(promisedOnMs: number, unplannedOffMs: number): number | null {
  return promisedOnMs > 0 ? 1 - unplannedOffMs / promisedOnMs : null;
}

/** Per day: share of promised-power time with power */
export function dayPromisedShare(d: DayComparison): number | null {
  return promisedShare(d.promisedOnMs, d.unplannedOffMs);
}

export interface ComparisonSummary {
  days: number;
  /** Share of promised-power time when there really was power */
  promisedShare: number | null;
  /** Share of planned-outage time when there was power anyway */
  bonusShare: number | null;
  plannedOffMs: number;
  actualOffMs: number;
  unplannedOffMs: number;
  spareOnMs: number;
  daysChanged: number;
  daysEmergency: number;
}

export function summarizeComparisons(days: DayComparison[]): ComparisonSummary {
  const sum = (f: (d: DayComparison) => number) => days.reduce((s, d) => s + f(d), 0);
  return {
    days: days.length,
    promisedShare: promisedShare(sum(d => d.promisedOnMs), sum(d => d.unplannedOffMs)),
    bonusShare: ratio(sum(d => d.spareOnMs), sum(d => d.plannedOffKnownMs)),
    plannedOffMs: sum(d => d.plannedOffMs),
    actualOffMs: sum(d => d.actualOffMs),
    unplannedOffMs: sum(d => d.unplannedOffMs),
    spareOnMs: sum(d => d.spareOnMs),
    daysChanged: days.filter(d => d.changed).length,
    daysEmergency: days.filter(d => d.emergency).length,
  };
}
