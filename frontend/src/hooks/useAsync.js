// Minimal data-fetching hook: run an async function on mount, track
// loading/error/data, and expose a refetch for after a mutation.
//
// Deliberately not a cache. Every page here loads a small list once, and a
// query library would be more machinery than the app currently earns.
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * @param {Function} fn   async function returning the data
 * @param {Array} deps    re-runs when these change
 */
export default function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });

  // Guards against setting state after unmount, and against an earlier slow
  // request overwriting a later one.
  const runIdRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const run = useCallback(async () => {
    const runId = ++runIdRef.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fn();
      if (mountedRef.current && runId === runIdRef.current) {
        setState({ data, error: null, loading: false });
      }
    } catch (err) {
      if (mountedRef.current && runId === runIdRef.current) {
        // A 401 has already redirected to /login; showing its message would
        // flash an error on the way out.
        if (err.name === 'SessionExpiredError') return;
        setState({ data: null, error: err.message, loading: false });
      }
    }
    // fn is intentionally not a dep: callers pass an inline arrow, which would
    // be a new reference every render and loop forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { run(); }, [run]);

  // Lets a page apply a mutation result without a full refetch.
  const setData = useCallback((updater) => {
    setState((s) => ({
      ...s,
      data: typeof updater === 'function' ? updater(s.data) : updater,
    }));
  }, []);

  return { ...state, refetch: run, setData };
}
