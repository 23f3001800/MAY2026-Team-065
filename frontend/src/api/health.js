// GET /health/ready — what is actually working right now.
//
// Unauthenticated on purpose: a probe has no credentials, and this is the one
// thing you want to be able to read when nothing else works. It returns nothing
// that is not already public — provider names, not keys or connection strings.
import { apiRequest } from './client';

/**
 * @returns {{
 *   status: 'ready'|'degraded',
 *   checks: {
 *     database:   {ok: boolean, error?: string},
 *     ai:         {ok: boolean, provider?: string, llmAvailable?: boolean, error?: string},
 *     mail:       {configured: boolean, host: string|null},
 *     slaSweeper: {enabled: boolean, running: boolean},
 *     cache:      {entries: number, hits: number, misses: number, hitRate: number|null},
 *   },
 * }}
 *
 * 503 is accepted rather than thrown: it means the database is unreachable, and
 * the body says so. That is the answer, not a failure to answer — throwing it
 * away would leave the panel showing "could not load" for the one case it
 * exists to report.
 *
 * A thrown error here therefore means something stronger: the request never
 * completed at all, so the API itself is unreachable.
 */
export function getReadiness() {
  return apiRequest('/health/ready', { auth: false, acceptStatuses: [503] });
}
