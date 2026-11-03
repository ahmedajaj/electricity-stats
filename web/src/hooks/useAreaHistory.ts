import { useEffect, useState } from 'react';

export interface AreaHistory {
  ids: string[];
  /** [timestamp, share per id (0–1 or null)] */
  rows: (number | null)[][];
}

const STALE_MS = 5 * 60_000;
// Shared by all area rows: one request per range, refreshed once the server has a new sample
const cache = new Map<number, { at: number; promise: Promise<AreaHistory> }>();

function fetchHistory(days: number) {
  const hit = cache.get(days);
  if (hit && Date.now() - hit.at < STALE_MS) return hit.promise;
  const promise = fetch(`api/areas/history?days=${days}`, { cache: 'no-store' }).then(res => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<AreaHistory>;
  });
  promise.catch(() => cache.delete(days));
  cache.set(days, { at: Date.now(), promise });
  return promise;
}

/** Server-sampled (every 5 min) svitlobot shares for the last `days` */
export function useAreaHistory(days: number) {
  const [history, setHistory] = useState<{ days: number; data: AreaHistory } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchHistory(days).then(
      data => {
        if (!cancelled) {
          setHistory({ days, data });
          setError(null);
        }
      },
      e => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [days]);

  return { history: history?.days === days ? history.data : null, error };
}
