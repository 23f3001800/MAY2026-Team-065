// Overdue work — complaints that have run past what the city promised.
//
// The SLA sweep has always detected breaches and raised notifications, but
// nothing could ask for the list, so an officer found overdue work by scrolling
// the pending queue and hoping. That is the thing they said was the problem.
//
// Everything here is a server aggregate (GET /complaints/escalations), computed
// from the same severity targets the sweep uses — 4h Critical, 24h High, 72h
// Medium, 168h Low — so the figures are Verified, not a browser guess.
//
// Deliberately not date-filtered. A complaint from eight months ago that is
// still open is exactly what this exists to surface; a window would hide it.
import React, { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import StatusBadge from '../../components/dashboard/StatusBadge';
import SeverityBadge from '../../components/dashboard/SeverityBadge';
import Provenance from '../../components/metrics/Provenance';
import { LoadingPanel, ErrorPanel, EmptyPanel } from '../../components/dashboard/AsyncStates';
import {
  IconAlertTriangle, IconCheckCircle, IconClock, IconRefresh, IconArrowRight,
  IconMapPin, IconUsers,
} from '../../components/dashboard/icons';
import { listEscalations } from '../../api/complaints';
import { complaintPath } from '../../api/session';
import { formatHours } from '../../lib/duration';
import useAsync from '../../hooks/useAsync';

function overdueBy(hoursRemaining) {
  return formatHours(Math.abs(hoursRemaining)) || '—';
}

/**
 * One overdue complaint.
 *
 * Leads with how far past the deadline it is, because that is the ordering key
 * and the only thing that distinguishes one row from the next at a glance.
 */
function Row({ item, tone }) {
  const breached = tone === 'breached';
  return (
    <li>
      <Link
        to={complaintPath('municipal_officer', item.complaintId)}
        className="focus-ring group flex items-start gap-3 px-4 py-3 hover:bg-surface-inset transition-colors"
      >
        <span
          className={`shrink-0 mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center ${
            breached ? 'bg-danger-50 text-danger-700' : 'bg-caution-50 text-caution-700'
          }`}
        >
          {breached ? <IconAlertTriangle size={16} /> : <IconClock size={16} />}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[14px] font-medium text-ink truncate">
              {item.description}
            </span>
            <span
              className={`shrink-0 text-[13px] font-bold tnum ${
                breached ? 'text-danger-700' : 'text-caution-700'
              }`}
            >
              {breached
                ? `${overdueBy(item.hoursRemaining)} over`
                : `${formatHours(item.hoursRemaining)} left`}
            </span>
          </div>

          <div className="flex items-center gap-2 mt-1 flex-wrap text-[11.5px] text-ink-faint">
            <span className="font-mono">{item.complaintId}</span>
            {item.department && (
              <>
                <span aria-hidden="true">·</span>
                <span>{item.department}</span>
              </>
            )}
            {item.address && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 truncate max-w-[220px]">
                  <IconMapPin size={11} /> {item.address}
                </span>
              </>
            )}
            {/* Nobody assigned is the most actionable fact on the row: it means
                the delay is dispatch, not the work. */}
            {!item.fieldWorkerId && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 font-semibold text-danger-700">
                  <IconUsers size={11} /> nobody assigned
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <SeverityBadge severity={item.severity} />
          <StatusBadge status={item.status} />
        </div>
        <IconArrowRight
          size={15}
          className="text-ink-faint shrink-0 mt-1 transition-transform group-hover:translate-x-0.5"
        />
      </Link>
    </li>
  );
}

export default function OfficerEscalations() {
  const [includeAtRisk, setIncludeAtRisk] = useState(true);
  const { data, error, loading, refetch } = useAsync(
    () => listEscalations({ includeAtRisk }),
    [includeAtRisk],
  );

  // Memoised because both are logical expressions: a fresh [] on every render
  // would make the useMemos below recompute every time, defeating the point.
  const breached = useMemo(() => data?.breached || [], [data]);
  const atRisk = useMemo(() => data?.atRisk || [], [data]);

  // Where the delay actually is. A department with six overdue jobs is a
  // resourcing conversation; six spread across six departments is not.
  const byDepartment = useMemo(() => {
    const counts = {};
    for (const item of breached) {
      const key = item.department || 'Unassigned';
      counts[key] = (counts[key] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [breached]);

  const unassigned = useMemo(
    () => breached.filter((i) => !i.fieldWorkerId).length,
    [breached],
  );

  const worst = breached[0] || null;

  const toggle = useCallback(() => setIncludeAtRisk((v) => !v), []);

  if (loading) {
    return <div className="max-w-[1100px] mx-auto"><LoadingPanel label="Checking what has run over…" variant="cards" /></div>;
  }
  if (error) {
    return <div className="max-w-[1100px] mx-auto"><ErrorPanel error={error} onRetry={refetch} /></div>;
  }

  return (
    <div className="max-w-[1100px] mx-auto space-y-5 animate-rise-in">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-[26px] font-bold text-ink leading-tight">Overdue</h1>
            <Provenance level="verified">Server aggregate</Provenance>
          </div>
          <p className="text-[14px] text-ink-muted mt-1">
            {breached.length === 0
              ? 'Nothing has run past its resolution target.'
              : `${breached.length} complaint${breached.length === 1 ? '' : 's'} past the target the city set.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            aria-pressed={includeAtRisk}
            className={`focus-ring px-3.5 py-2 rounded-lg border text-[13px] font-semibold transition-colors ${
              includeAtRisk
                ? 'bg-caution-50 border-caution-500/40 text-caution-800'
                : 'bg-surface border-line text-ink-body hover:border-civic-400'
            }`}
          >
            Include at risk
          </button>
          <button
            onClick={refetch}
            className="focus-ring lift inline-flex items-center gap-2 bg-surface border border-line hover:border-civic-400 text-ink-body font-semibold text-[13px] px-3.5 py-2 rounded-lg shadow-sm transition-all"
          >
            <IconRefresh size={15} /> Refresh
          </button>
        </div>
      </header>

      {breached.length === 0 && atRisk.length === 0 ? (
        <EmptyPanel
          icon={IconCheckCircle}
          title="Nothing overdue"
          message="Every open complaint is inside the resolution target for its severity."
        />
      ) : (
        <>
          {breached.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-surface rounded-xl border border-line shadow-sm p-4">
                <div className="font-display text-[24px] font-bold text-danger-700 leading-none tnum">
                  {breached.length}
                </div>
                <div className="text-[12px] text-ink-muted mt-1.5">Past the target</div>
                {worst && (
                  <div className="text-[11px] text-ink-faint mt-2">
                    Worst is {overdueBy(worst.hoursRemaining)} over
                  </div>
                )}
              </div>
              <div className="bg-surface rounded-xl border border-line shadow-sm p-4">
                <div className={`font-display text-[24px] font-bold leading-none tnum ${
                  unassigned ? 'text-danger-700' : 'text-ink'
                }`}>
                  {unassigned}
                </div>
                <div className="text-[12px] text-ink-muted mt-1.5">Nobody assigned</div>
                <div className="text-[11px] text-ink-faint mt-2">
                  {unassigned
                    ? 'These are waiting on dispatch, not on work.'
                    : 'Every overdue complaint has a worker.'}
                </div>
              </div>
              <div className="bg-surface rounded-xl border border-line shadow-sm p-4">
                <div className="text-[12px] text-ink-muted mb-2">Where the delay sits</div>
                {byDepartment.length === 0 ? (
                  <p className="text-[12px] text-ink-faint">No department recorded.</p>
                ) : (
                  <ul className="space-y-1">
                    {byDepartment.slice(0, 3).map(([dept, n]) => (
                      <li key={dept} className="flex items-baseline justify-between gap-2 text-[12.5px]">
                        <span className="text-ink-body truncate">{dept}</span>
                        <span className="font-semibold text-ink tnum shrink-0">{n}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {breached.length > 0 && (
            <section className="bg-surface rounded-xl border border-line shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 border-b border-line bg-danger-50/50 flex items-center gap-2">
                <IconAlertTriangle size={14} className="text-danger-700" />
                <h2 className="text-[12px] font-bold uppercase tracking-wide text-danger-700">
                  Past the target · {breached.length}
                </h2>
                <span className="text-[11px] text-ink-faint ml-auto">Most overdue first</span>
              </div>
              <ul className="divide-y divide-line">
                {breached.map((item) => (
                  <Row key={item.complaintId} item={item} tone="breached" />
                ))}
              </ul>
            </section>
          )}

          {includeAtRisk && atRisk.length > 0 && (
            <section className="bg-surface rounded-xl border border-line shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 border-b border-line bg-caution-50/50 flex items-center gap-2">
                <IconClock size={14} className="text-caution-700" />
                <h2 className="text-[12px] font-bold uppercase tracking-wide text-caution-700">
                  At risk · {atRisk.length}
                </h2>
                <span className="text-[11px] text-ink-faint ml-auto">
                  Inside the last quarter of their window
                </span>
              </div>
              <ul className="divide-y divide-line">
                {atRisk.map((item) => (
                  <Row key={item.complaintId} item={item} tone="atRisk" />
                ))}
              </ul>
            </section>
          )}

          {includeAtRisk && atRisk.length === 0 && breached.length > 0 && (
            <p className="text-[13px] text-ink-muted bg-surface-inset rounded-lg px-3.5 py-3">
              Nothing else is close to breaching.
            </p>
          )}
        </>
      )}
    </div>
  );
}
