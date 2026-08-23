// One place to turn a failed action into something worth reading.
//
// Every page that mutates something had the same three lines -- catch, ignore
// SessionExpiredError, put err.message in a red banner -- which flattened two
// genuinely different failures into one. A 403 means stop; a 409 means the
// record moved underneath you and the same action may well work once you have
// looked again. Showing both in the same red box sends people to the wrong fix.
//
// The server's own wording is always kept: the 409 detail names the valid next
// steps, which is more useful than anything the client could invent.
import { useCallback, useState } from 'react';
import { describeApiError } from '../api/client';

/**
 * @returns {{
 *   failure: {tone, heading, message, recoverable}|null,
 *   report: (err: Error) => object|null,  // null when swallowed (expired session)
 *   clear: () => void,
 * }}
 */
export default function useActionError() {
  const [failure, setFailure] = useState(null);

  const report = useCallback((err) => {
    // The client has already cleared the session and redirected; a banner on a
    // page that is being navigated away from is noise.
    if (err?.name === 'SessionExpiredError') return null;
    const described = describeApiError(err);
    setFailure(described);
    return described;
  }, []);

  const clear = useCallback(() => setFailure(null), []);

  return { failure, report, clear };
}
