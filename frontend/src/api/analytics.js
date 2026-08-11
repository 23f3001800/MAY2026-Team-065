// Server-side analytics (`/analytics/*`).
//
// These replace browser aggregation over the full complaint list. That mattered
// for more than performance: figures computed here are real server aggregates,
// so the UI can label them **Verified** rather than **Derived** — and average
// resolution time becomes answerable at all, because the backend now stores
// `resolvedAt`.
//
// Every endpoint is officer- and admin-readable. Citizens and field workers get
// a 403; their own views are already scoped to them.
//
// NULL MEANS UNKNOWN, NEVER ZERO. The backend deliberately returns null for
// figures it cannot compute — `avgResolutionHours` when nothing has resolved,
// `resolutionRatePct` over zero complaints. Callers must render "insufficient
// data" for those, not a zero, which would read as "we resolve nothing".
import { apiRequest } from './client';

// Dates go over the wire as YYYY-MM-DD; the backend treats `to` as inclusive of
// its whole day.
function range(from, to) {
  return { from: from || undefined, to: to || undefined };
}

/**
 * Headline figures. `previous` is absent — not zeroed — when no prior window
 * holds anything, so a comparison is only ever shown against real data.
 */
export function getOverview({ from, to } = {}) {
  return apiRequest('/analytics/overview', { params: range(from, to) });
}

// Daily created/resolved counts. Zero days are included, so the series can be
// plotted directly without gap-filling.
export function getTrends({ from, to } = {}) {
  return apiRequest('/analytics/trends', { params: range(from, to) });
}

// Every configured category, including those with a count of zero.
export function getCategoryBreakdown({ from, to } = {}) {
  return apiRequest('/analytics/categories', { params: range(from, to) });
}

// Open complaints by age. Deliberately not date-filtered server-side — an
// eight-month-old open complaint is the point of the endpoint.
export function getAging() {
  return apiRequest('/analytics/aging');
}

// Turnaround by department and by worker, with median alongside mean.
export function getResolutionPerformance({ from, to } = {}) {
  return apiRequest('/analytics/resolution', { params: range(from, to) });
}

/**
 * Fetches everything a dashboard needs in one call site.
 *
 * Uses allSettled so one failing endpoint degrades a single panel instead of
 * blanking the page — the dashboards already render an insufficient-data state
 * per tile, and that is a better outcome than an error screen.
 */
export async function getDashboardAnalytics({ from, to } = {}) {
  const [overview, trends, categories, aging] = await Promise.allSettled([
    getOverview({ from, to }),
    getTrends({ from, to }),
    getCategoryBreakdown({ from, to }),
    getAging(),
  ]);
  const value = (r) => (r.status === 'fulfilled' ? r.value : null);
  return {
    overview: value(overview),
    trends: value(trends),
    categories: value(categories),
    aging: value(aging),
  };
}
