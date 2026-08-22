// Shared readiness state.
//
// Two panels want it — the health indicator on the admin dashboard, and the SLA
// sweep panel, which needs to know whether the background sweeper is actually
// running before it tells anybody that nothing checks on a schedule. Cached
// module-wide so mounting both is one request, with an explicit refresh for the
// button.
//
// The cache has a short life on purpose: this is a "what is broken right now"
// answer, and a stale one is worse than none.
import { useCallback, useEffect, useState } from 'react';
import { getReadiness } from '../api/health';

const TTL_MS = 30_000;

let cache = null;      // { at: number, data: object }
let inflight = null;

function load({ force = false } = {}) {
  if (!force && cache && Date.now() - cache.at < TTL_MS) {
    return Promise.resolve(cache.data);
  }
  if (force) cache = null;
  if (!inflight) {
    inflight = getReadiness()
      .then((data) => {
        cache = { at: Date.now(), data };
        inflight = null;
        return data;
      })
      .catch((err) => {
        inflight = null;
        throw err;
      });
  }
  return inflight;
}

/**
 * @returns {{
 *   readiness: object|null,
 *   error: string,   // set only when the API could not be reached at all
 *   loading: boolean,
 *   refresh: () => void,
 * }}
 */
export default function useReadiness() {
  const [readiness, setReadiness] = useState(cache?.data || null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!cache);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    load({ force: nonce > 0 })
      .then((data) => {
        if (!alive) return;
        setReadiness(data);
        setError('');
      })
      .catch((err) => {
        if (!alive) return;
        // A 503 comes back as data, so reaching here means the request itself
        // failed — the API is unreachable, not merely degraded.
        setError(err.message);
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [nonce]);

  return { readiness, error, loading, refresh };
}
