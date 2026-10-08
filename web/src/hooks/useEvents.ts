import { useCallback, useEffect, useState } from 'react';
import type { RawEvent } from '../lib/stats.ts';

const REFRESH_MS = 5 * 60_000;

interface State {
  events: RawEvent[] | null;
  error: string | null;
  loadedAt: number | null;
  loading: boolean;
}

/** Loads events from the API and refreshes them every 5 minutes */
export function useEvents() {
  const [state, setState] = useState<State>({ events: null, error: null, loadedAt: null, loading: true });

  const load = useCallback(async () => {
    setState(s => ({ ...s, loading: true }));
    try {
      const res = await fetch('api/events', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const events = (await res.json()) as RawEvent[];
      setState({ events, error: null, loadedAt: Date.now(), loading: false });
    } catch (e) {
      // Keep showing the last good data if a refresh fails
      setState(s => ({ ...s, error: e instanceof Error ? e.message : String(e), loading: false }));
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  return { ...state, reload: load };
}

/** Current time, ticking every `intervalMs` */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
