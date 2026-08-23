// Which status buttons to show for one complaint, asked of the server.
//
// The rule has two halves -- what the lifecycle permits from the complaint's
// current status, and what this role is allowed to do -- and only the server
// holds both. A client-side role map answers the second half and guesses at the
// first, which is how you end up offering RESOLVED on a complaint nobody has
// been dispatched to: the button looks fine, the officer presses it, and the
// backend answers 409.
//
// So this asks GET /complaints/{id}/allowed-statuses and re-asks after every
// status change, because the answer moves with the status.
//
// It falls back to the static role map when the call fails. That map is too
// generous -- it is the old behaviour, 409s and all -- but a menu with a few
// dead options beats a panel with no controls, and `stale` is exposed so the UI
// can say which one the user is looking at.
import { useCallback, useEffect, useState } from 'react';
import { getAllowedStatuses } from '../api/complaints';
import { statusesSettableBy, statusOwnerNote } from '../api/mappers';

/**
 * @param {string} complaintId
 * @param {object} opts
 *   role    the signed-in user's role, used only for the fallback
 *   status  the complaint's current UI status; changing it triggers a refetch
 * @returns {{
 *   allowed: string[],      // offer these
 *   transitions: string[],  // legal from here for somebody, offer disabled
 *   loading: boolean,
 *   stale: boolean,         // true when this is the fallback, not the server's answer
 *   refetch: () => void,
 *   reasonFor: (status: string) => string|null,
 * }}
 */
export default function useAllowedStatuses(complaintId, { role, status } = {}) {
  const [state, setState] = useState({ allowed: [], transitions: [], stale: false });
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!complaintId) { setLoading(false); return undefined; }
    let alive = true;
    setLoading(true);

    getAllowedStatuses(complaintId)
      .then((res) => {
        if (!alive) return;
        setState({ allowed: res.allowed, transitions: res.transitions, stale: false });
      })
      .catch((err) => {
        if (!alive) return;
        if (err.name === 'SessionExpiredError') return;
        // The role map knows nothing about the current status, so at least
        // drop the status the complaint is already in.
        const guess = statusesSettableBy(role).filter((s) => s !== status);
        setState({ allowed: guess, transitions: guess, stale: true });
      })
      .finally(() => { if (alive) setLoading(false); });

    return () => { alive = false; };
  }, [complaintId, role, status, nonce]);

  // Why a status is legal from here but not on offer to this user. Null when
  // the move is simply out of order, which the caller words differently.
  const reasonFor = useCallback(
    (s) => (state.transitions.includes(s) && !state.allowed.includes(s)
      ? statusOwnerNote(s)
      : null),
    [state.allowed, state.transitions],
  );

  return { ...state, loading, refetch, reasonFor };
}
