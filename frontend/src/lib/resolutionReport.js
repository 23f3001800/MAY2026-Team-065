// Average resolution time, computed honestly.
//
// The dashboards show "insufficient verified data" for this, and that is
// correct THERE: the only timestamp on a complaint is `updatedAt`, which moves
// on any edit, so a page-load metric derived from it would be wrong.
//
// A report is a different situation. It is an on-demand action the admin
// explicitly asked for, so it can afford to do what a dashboard cannot: walk
// GET /complaints/{id}/history per complaint and read the ACTUAL timestamp of
// the transition into RESOLVED. That is the real number.
//
// The cost is one request per resolved complaint, which is why this is not on
// the dashboard. Requests run in small batches to avoid opening 200 sockets at
// once, and the sample is capped — with the cap reported, never silently
// applied, because "average over 50 of 178" and "average over 178" are
// different claims.
import { getComplaintHistory } from '../api/complaints';

const BATCH = 6;
const DAY_MS = 86400000;

export const DEFAULT_SAMPLE_CAP = 60;

async function inBatches(items, size, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...await Promise.all(items.slice(i, i + size).map(fn)));
  }
  return out;
}

/**
 * @param {Array} complaints  UI-shaped complaints
 * @param {object} [opts]
 * @param {number} [opts.cap]         max complaints to sample
 * @param {Function} [opts.onProgress] (done, total) — real progress, one tick
 *                                     per completed request
 * @returns {{
 *   avgDays: number|null, medianDays: number|null,
 *   sampled: number, eligible: number, capped: boolean,
 *   unusable: number, fastest: number|null, slowest: number|null
 * }}
 */
export async function computeResolutionTimes(complaints, opts = {}) {
  const cap = opts.cap ?? DEFAULT_SAMPLE_CAP;
  const onProgress = opts.onProgress;

  const resolvedStates = ['Resolved', 'Verified'];
  const eligible = (complaints || []).filter((c) => resolvedStates.includes(c.status));

  // Newest first: a recent sample describes how the team is performing now,
  // not how it performed a year ago.
  const ordered = [...eligible].sort((a, b) => new Date(b.reportedAt) - new Date(a.reportedAt));
  const sample = ordered.slice(0, cap);

  let done = 0;
  const durations = await inBatches(sample, BATCH, async (c) => {
    try {
      const history = await getComplaintHistory(c.id);
      // First entry into Resolved — a complaint reopened and resolved again
      // should count the first fix, not the last.
      const hit = [...history]
        .sort((a, b) => new Date(a.at) - new Date(b.at))
        .find((h) => h.status === 'Resolved');
      if (!hit) return null;
      const ms = new Date(hit.at) - new Date(c.reportedAt);
      return ms > 0 ? ms / DAY_MS : null;
    } catch {
      // One unreadable history should not sink the whole report.
      return null;
    } finally {
      done += 1;
      onProgress?.(done, sample.length);
    }
  });

  const usable = durations.filter((d) => typeof d === 'number').sort((a, b) => a - b);

  if (!usable.length) {
    return {
      avgDays: null, medianDays: null,
      sampled: sample.length, eligible: eligible.length,
      capped: eligible.length > cap, unusable: sample.length,
      fastest: null, slowest: null,
    };
  }

  const sum = usable.reduce((a, b) => a + b, 0);
  const mid = Math.floor(usable.length / 2);

  return {
    avgDays: sum / usable.length,
    // Median as well as mean: one complaint that sat for a year drags an
    // average somewhere no individual complaint actually is.
    medianDays: usable.length % 2 ? usable[mid] : (usable[mid - 1] + usable[mid]) / 2,
    sampled: usable.length,
    eligible: eligible.length,
    capped: eligible.length > cap,
    unusable: sample.length - usable.length,
    fastest: usable[0],
    slowest: usable[usable.length - 1],
  };
}
