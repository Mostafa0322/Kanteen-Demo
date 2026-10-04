import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/mock-api';

export interface ApiState<T> {
  data: T | undefined;
  error: unknown;
  /** True only while there is no data yet for the current inputs. */
  loading: boolean;
  /** True while any request is in flight (including background refreshes). */
  refreshing: boolean;
  reload: () => void;
}

/**
 * Fetch from the API and keep the result live: refetches whenever the data
 * store changes (in this tab or any other), without flashing a spinner.
 */
export function useApi<T>(fn: () => Promise<T>, deps: unknown[], opts: { live?: boolean; enabled?: boolean } = {}): ApiState<T> {
  const { live = true, enabled = true } = opts;
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const key = JSON.stringify(deps);
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<{ key: string; data?: T; error?: unknown; inflight: boolean }>({ key, inflight: true });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setState((s) => (s.key === key ? { ...s, inflight: true } : { key, inflight: true }));
    fnRef.current().then(
      (data) => !cancelled && setState({ key, data, inflight: false }),
      (error) => !cancelled && setState((s) => ({ key, data: s.key === key ? s.data : undefined, error, inflight: false })),
    );
    return () => {
      cancelled = true;
    };
  }, [key, tick, enabled]);

  useEffect(() => {
    if (!live) return;
    return api.subscribe((e) => {
      if (e.type === 'db-changed') setTick((t) => t + 1);
    });
  }, [live]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const current = state.key === key;
  return {
    data: current ? state.data : undefined,
    error: current ? state.error : undefined,
    loading: enabled && (!current || (state.inflight && state.data === undefined && !state.error)),
    refreshing: state.inflight,
    reload,
  };
}

/** Wrap an async action with pending/error state. */
export function useAction<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const run = useCallback(
    async (...args: A): Promise<R | undefined> => {
      setPending(true);
      setError(null);
      try {
        return await fn(...args);
      } catch (e) {
        setError(e);
        return undefined;
      } finally {
        setPending(false);
      }
    },
    [fn],
  );
  return { run, pending, error, setError };
}
