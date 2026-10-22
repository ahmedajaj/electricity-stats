import { useEffect, useState } from 'react';
import type { ScheduleArchive } from '../lib/schedule.ts';

const REFRESH_MS = 5 * 60_000;

/** Collected ЯСНО schedule revisions, refreshed every 5 minutes */
export function useSchedule() {
  const [archive, setArchive] = useState<ScheduleArchive | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('api/schedule', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as ScheduleArchive;
        if (!cancelled) {
          setArchive(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    };
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return { archive, error };
}
