// Turning a complaint's officerId into something a person can read.
//
// The complaint payload carries ids, not names, and there is no public endpoint
// that resolves one: the only user directory is GET /admin/users, which is
// administrator-only. So how much can be said depends on who is asking, and
// this hook is deliberate about not pretending otherwise:
//
//   it is you          the most useful answer, and the one an officer actually
//                      wants -- "is this mine to look at?" Available to every
//                      role, because the id is in the caller's own token.
//   an administrator   can read the directory, so the officer gets a name.
//   anyone else        gets null, and the caller words it from the department
//                      instead. A raw UUID on screen is not an answer.
//
// If officers ever need to see each other by name, the fix is a name on
// ComplaintResponse, not a wider directory endpoint.
import { useEffect, useState } from 'react';
import { listUsers } from '../api/admin';
import { getCurrentUser } from '../api/session';

// The directory is small, changes rarely, and several complaint views ask for
// it at once. Cached module-wide, like useCategories.
let cache = null;
let inflight = null;

function loadDirectory() {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = listUsers()
      .then((users) => {
        cache = new Map((users || []).map((u) => [u.id, u]));
        inflight = null;
        return cache;
      })
      .catch(() => {
        inflight = null;
        // An empty directory rather than a retry storm. Every lookup then
        // misses and the caller falls back to the department wording, which is
        // the same thing a non-admin sees.
        cache = new Map();
        return cache;
      });
  }
  return inflight;
}

/**
 * @param {string|null} officerId
 * @returns {{label: string|null, isYou: boolean, loading: boolean}}
 *   label is null when the id cannot be resolved -- render the department
 *   instead, never the id.
 */
export default function useOfficerName(officerId) {
  const me = getCurrentUser();
  const isYou = Boolean(officerId) && officerId === me?.userId;
  const canResolve = me?.role === 'admin' && Boolean(officerId) && !isYou;

  const [label, setLabel] = useState(null);
  const [loading, setLoading] = useState(canResolve);

  useEffect(() => {
    if (!canResolve) {
      setLabel(null);
      setLoading(false);
      return undefined;
    }
    let alive = true;
    setLoading(true);
    loadDirectory().then((dir) => {
      if (!alive) return;
      setLabel(dir.get(officerId)?.name || null);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [officerId, canResolve]);

  if (isYou) return { label: 'You', isYou: true, loading: false };
  return { label, isYou: false, loading };
}
