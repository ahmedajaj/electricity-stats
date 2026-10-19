import { useEffect, useState } from 'react';

export interface AreaStat {
  id: string;
  name: string;
  on: number;
  off: number;
  noData: number;
  /** Share of points with power among those reporting on/off, 0–1 */
  onShare: number | null;
}

export interface AreaStats {
  updatedAt: number;
  areas: AreaStat[];
}

const REFRESH_MS = 2 * 60_000;

/** Live svitlobot.in.ua stats for Osokorky and Kyiv, refreshed every 2 minutes */
export function useAreaStats() {
  const [stats, setStats] = useState<AreaStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('api/areas', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as AreaStats;
        if (!cancelled) {
          setStats(data);
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

  return { stats, error };
}
