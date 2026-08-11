// Every derived operations metric, in one place.
//
// The backend has no analytics service — /admin/analytics returns a total and
// two breakdowns, and is administrator-only. So these are aggregated in the
// browser from GET /complaints/, which returns the complete record set for
// officers and admins.
//
// That is a real, reproducible source, but it is NOT a server-side aggregate,
// and the UI labels it "Derived" rather than "Verified" to keep the difference
// visible. Keeping the arithmetic here rather than in components means there is
// exactly one definition of "resolution rate" in the app, and it can be read
// and checked without opening a page.
//
// WHAT IS DELIBERATELY ABSENT, and why:
//
//   Average resolution time. The only timestamp on a complaint is `updatedAt`,
//   which moves on ANY edit — a category change, a remark, a reassignment. Using
//   it as a resolution time yields a confident, plausible, wrong number. It
//   needs either a resolvedAt column or a per-complaint /history walk. Until
//   then callers get null and render "insufficient verified data".
//
//   Period-over-period comparisons ("+12% vs last month"). Nothing stores a
//   historical snapshot, and recomputing a past period from current records
//   cannot see complaints deleted or merged since. Absent rather than invented.

import { TERMINAL_STATUSES } from '../api/mappers';

// Statuses that count as work finished, for the resolution rate.
const RESOLVED_STATES = ['Resolved', 'Verified'];

// Statuses that mean nobody has picked it up yet.
const UNTRIAGED_STATES = ['New', 'Under Review'];

const DAY_MS = 86400000;

function countBy(items, key) {
  const out = {};
  for (const item of items) {
    const k = typeof key === 'function' ? key(item) : item[key];
    if (k === undefined || k === null) continue;
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

function daysSince(iso) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / DAY_MS);
}

/**
 * @param {Array} complaints UI-shaped complaints (see mappers.fromApiComplaint)
 * @returns an object where every numeric field is either a real count or null.
 *          null always means "cannot be known from available data" — never zero.
 */
export function computeMetrics(complaints) {
  const all = Array.isArray(complaints) ? complaints : [];
  const total = all.length;

  // With no complaints at all, counts are genuinely zero rather than unknown,
  // but a *rate* is undefined — you cannot divide by zero and calling it 0%
  // would read as "we resolve nothing".
  const byStatus = countBy(all, 'status');
  const bySeverity = countBy(all, 'severity');
  const byCategory = countBy(all, 'category');
  const byDepartment = countBy(all, (c) => c.department || 'Unassigned');

  const resolved = all.filter((c) => RESOLVED_STATES.includes(c.status)).length;
  const closed = all.filter((c) => TERMINAL_STATUSES.includes(c.status)).length;
  const open = total - closed;
  const untriaged = all.filter((c) => UNTRIAGED_STATES.includes(c.status)).length;
  const unassignedNew = byStatus.New || 0;

  const resolutionRate = total > 0 ? (resolved / total) * 100 : null;

  // Ageing, over OPEN complaints only — a complaint closed six months ago is
  // not "180 days old", it is done.
  const openComplaints = all.filter((c) => !TERMINAL_STATUSES.includes(c.status));
  const ageBuckets = { '0-2 days': 0, '3-7 days': 0, '8-30 days': 0, '30+ days': 0 };
  let oldestOpenDays = null;
  for (const c of openComplaints) {
    const age = daysSince(c.reportedAt);
    if (age === null) continue;
    if (oldestOpenDays === null || age > oldestOpenDays) oldestOpenDays = age;
    if (age <= 2) ageBuckets['0-2 days'] += 1;
    else if (age <= 7) ageBuckets['3-7 days'] += 1;
    else if (age <= 30) ageBuckets['8-30 days'] += 1;
    else ageBuckets['30+ days'] += 1;
  }

  const critical = (bySeverity.Critical || 0) + (bySeverity.High || 0);
  const withCoords = all.filter((c) => c.coords).length;
  const triaged = all.filter((c) => c.ai).length;

  return {
    total,
    open,
    closed,
    resolved,
    untriaged,
    unassignedNew,
    resolutionRate,
    criticalAndHigh: critical,
    withCoords,
    triaged,
    oldestOpenDays,
    byStatus,
    bySeverity,
    byCategory,
    byDepartment,
    ageBuckets,

    // See the header comment. Present so callers do not reinvent them badly.
    avgResolutionHours: null,
    previousPeriodComparison: null,
  };
}

/**
 * Daily complaint volume over the last `days` days.
 * Returns one entry per day including zeroes, so a quiet Sunday shows as a gap
 * in the line rather than being silently skipped and distorting the shape.
 */
export function volumeSeries(complaints, days = 30) {
  const all = Array.isArray(complaints) ? complaints : [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const buckets = new Map();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today.getTime() - i * DAY_MS);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }

  let counted = 0;
  for (const c of all) {
    const key = String(c.reportedAt || '').slice(0, 10);
    if (buckets.has(key)) {
      buckets.set(key, buckets.get(key) + 1);
      counted += 1;
    }
  }

  return {
    points: [...buckets.entries()].map(([date, count]) => ({ date, count })),
    counted,
    // How much of the record set falls inside the window — a chart covering
    // 3 of 200 complaints should say so rather than implying it is the whole
    // picture.
    total: all.length,
  };
}

// Sorted [label, count] pairs, largest first. `limit` caps the list; the
// remainder is returned separately rather than dropped silently.
export function ranked(counts, limit = 5) {
  const entries = Object.entries(counts || {}).sort((a, b) => b[1] - a[1]);
  const top = entries.slice(0, limit);
  const restCount = entries.slice(limit).reduce((sum, [, n]) => sum + n, 0);
  return { top, restCount, totalKeys: entries.length };
}

export { RESOLVED_STATES, UNTRIAGED_STATES };
