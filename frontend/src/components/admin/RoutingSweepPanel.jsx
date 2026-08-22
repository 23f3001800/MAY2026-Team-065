// Backfill: give every ownerless open complaint to its department's officer.
//
// Complaints get an owner on filing now. That does nothing for the ones already
// in the system — they were created when ownership was a side effect of
// dispatch, so anything never dispatched has no officer. Officer notifications
// for escalation, resolution and SLA breach are addressed to officerId, which
// means for those complaints they are being created for nobody.
//
// Two things this panel is careful about:
//
//   * `unroutable` is not an error and is not transient. Those departments have
//     no officer at all, and running the sweep again will produce exactly the
//     same list. So it stays on screen as a staffing gap with a link to fix it,
//     rather than flashing past in a toast.
//   * running it twice is harmless — it only touches complaints where officerId
//     is null — so the button is not disabled after a successful run.
//
// Response shape (the endpoint is untyped in openapi):
//   { message, considered, routed, unroutable: { [department]: count } }
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  IconUsers, IconCheckCircle, IconAlertTriangle, IconRefresh,
} from '../dashboard/icons';
import { routeUnassignedComplaints } from '../../api/admin';

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export default function RoutingSweepPanel() {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    setError('');
    try {
      setResult(await routeUnassignedComplaints());
    } catch (err) {
      if (err.name !== 'SessionExpiredError') setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  // Object.entries on a possibly-absent field: an older backend that returns
  // only counts should not blank the panel.
  const unroutable = Object.entries(result?.unroutable || {})
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  return (
    <section className="bg-white rounded-2xl border border-line shadow-sm p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
            <IconUsers size={18} />
          </span>
          <div className="min-w-0">
            <h2 className="font-semibold text-ink text-[15px]">Unassigned complaint routing</h2>
            <p className="text-[13px] text-ink-muted mt-0.5 max-w-lg leading-snug">
              Gives every open complaint with no owning officer to whoever runs its
              department. Until it has one, the escalation, resolution and breach
              notices for that complaint are addressed to nobody.
            </p>
          </div>
        </div>
        <button
          onClick={run}
          disabled={running}
          className="focus-ring lift shrink-0 inline-flex items-center gap-2 bg-primary hover:bg-leaf-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-[13px] px-3.5 py-2 rounded-lg shadow-btn transition-all"
        >
          <IconRefresh size={15} className={running ? 'animate-spin-slow' : ''} />
          {running ? 'Routing…' : 'Route unassigned'}
        </button>
      </div>

      {error && (
        <p role="alert" className="flex items-start gap-2 mt-3 text-[13px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <IconAlertTriangle size={15} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}

      {result && (
        <div className="mt-4 space-y-3">
          <div className="flex items-start gap-2 text-[13px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            <IconCheckCircle size={15} className="mt-0.5 shrink-0" />
            <span>
              {result.considered === 0
                ? 'Every open complaint already has an owning officer.'
                : `${plural(result.considered, 'ownerless complaint')} considered — ${plural(result.routed, 'given an owner')}.`}
            </span>
          </div>

          {unroutable.length > 0 && (
            <div className="rounded-lg border border-caution-100 bg-caution-50 px-3 py-2.5">
              <div className="flex items-start gap-2">
                <IconAlertTriangle size={15} className="mt-0.5 shrink-0 text-caution-700" />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-caution-700">
                    {plural(unroutable.length, 'department')} with no officer at all
                  </p>
                  <p className="text-[12.5px] text-ink-body mt-1 leading-snug">
                    These complaints could not be routed because there is nobody to route
                    them to. Running this again will not change that — the fix is to
                    appoint an officer.
                  </p>

                  <ul className="mt-2.5 space-y-1">
                    {unroutable.map(([department, count]) => (
                      <li
                        key={department}
                        className="flex items-baseline justify-between gap-3 text-[12.5px]"
                      >
                        <span className="font-medium text-ink truncate">{department}</span>
                        <span className="tnum shrink-0 text-ink-muted">
                          {plural(count, 'complaint')} waiting
                        </span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    to="/admin/users"
                    className="focus-ring mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-primary hover:underline rounded"
                  >
                    Add an officer <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <p className="text-[11px] text-ink-faint mt-4 pt-3 border-t border-slate-100">
        Safe to run as often as you like — it only touches complaints that have no officer,
        so a second run is not a second pass over the same records.
      </p>
    </section>
  );
}
