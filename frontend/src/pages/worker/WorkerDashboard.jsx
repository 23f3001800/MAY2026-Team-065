// Field worker overview: availability toggle and open-task KPIs/list, backed
// by real endpoints.
//
// Tasks come from GET /complaints/worker/tasks. The previous mocked version
// had an "In Progress" stage a worker could move a task through locally --
// the backend's StatusEnum has no such value (PENDING | ASSIGNED | RESOLVED |
// REJECTED), so the only real transition here is straight to Resolved or
// Rejected via PATCH /complaints/{id}/status. There is also no rating
// endpoint to average, so "Avg. Rating" -- which was invented in the mock --
// has been dropped rather than kept with fake numbers.
import { useNavigate } from 'react-router-dom';
import React, { useMemo, useState } from 'react';
import StatusBadge from '../../components/dashboard/StatusBadge';
import SeverityBadge from '../../components/dashboard/SeverityBadge';
import { LoadingPanel, ErrorPanel } from '../../components/dashboard/AsyncStates';
import {
  IconMapPin, IconCheckCircle, IconClipboard, IconClock,
} from '../../components/dashboard/icons';
import { listMyTasks } from '../../api/complaints';
import { setMyAvailability } from '../../api/workers';
import useAsync from '../../hooks/useAsync';

const AVAIL_STYLE = {
  AVAILABLE: 'bg-emerald-500 text-white',
  UNAVAILABLE: 'bg-slate-400 text-white',
};

export default function WorkerDashboard() {
  const navigate = useNavigate();

  const { data, error, loading, refetch } = useAsync(() => listMyTasks(), []);
  const tasks = useMemo(() => data || [], [data]);

  // No GET for the worker's own availabilityStatus (see WorkerProfile) --
  // only PATCH exists, so this stays null ("not confirmed") until they set it.
  const [availability, setAvailability] = useState(null);
  const [availBusy, setAvailBusy] = useState(false);

  const [toast, setToast] = useState('');


  const handleAvailability = async (available) => {
    setAvailBusy(true);
    try {
      const result = await setMyAvailability(available);
      setAvailability(result.availabilityStatus);
    } catch (err) {
      if (err.name !== 'SessionExpiredError') setToast(err.message);
    } finally {
      setAvailBusy(false);
    }
  };


  // Framed as a shift, not a record count: what is on me now, what is waiting,
  // what I have handed back for review.
  const shift = useMemo(() => {
    const by = (...ss) => tasks.filter((t) => ss.includes(t.status));
    return {
      active: by('In Progress'),
      queued: by('Assigned', 'Reopened'),
      held: by('On Hold'),
      submitted: by('Resolved'),
    };
  }, [tasks]);

  return (
    <div className="max-w-[1100px] mx-auto space-y-5 animate-rise-in">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Today's work</h1>
          <p className="text-[14px] text-slate-500">Here are the tasks assigned to you.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-slate-400 mr-1">Availability</span>
          <button
            onClick={() => handleAvailability(true)}
            disabled={availBusy}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors disabled:opacity-60 ${
              availability === 'AVAILABLE' ? AVAIL_STYLE.AVAILABLE : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          >
            Available
          </button>
          <button
            onClick={() => handleAvailability(false)}
            disabled={availBusy}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors disabled:opacity-60 ${
              availability === 'UNAVAILABLE' ? AVAIL_STYLE.UNAVAILABLE : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          >
            Off Duty
          </button>
        </div>
      </div>

      {toast && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[13px] font-medium px-4 py-3 rounded-xl">
          <IconCheckCircle size={16} className="shrink-0" /> {toast}
        </div>
      )}

      {loading ? (
        <LoadingPanel label="Loading your tasks…" variant="stats" />
      ) : error ? (
        <ErrorPanel error={error} onRetry={refetch} />
      ) : (
        <>
          {/* What is on me right now. A worker's dashboard should answer
              "what am I doing" before it answers "how many of each". */}
          {shift.active.length > 0 && (
            <section>
              <h2 className="font-display text-[15px] font-bold text-ink mb-2.5">Currently working</h2>
              <ul className="space-y-2.5">
                {shift.active.map((t) => (
                  <li key={t.id}>
                    <button
                      onClick={() => navigate(`/worker/tasks/${t.id}`)}
                      className="focus-ring lift w-full text-left bg-surface rounded-xl border border-civic-300 ring-1 ring-civic-100 shadow-sm p-4 hover:shadow-md transition-all"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-civic-700 mb-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-civic-600 animate-pulse-dot" /> on this now
                          </div>
                          <div className="text-[15px] font-semibold text-ink leading-snug">{t.issue}</div>
                          <div className="flex items-center gap-1.5 text-[12px] text-ink-muted mt-1">
                            <IconMapPin size={12} className="text-ink-faint" />
                            <span className="truncate">{t.location}</span>
                          </div>
                        </div>
                        <SeverityBadge severity={t.severity} />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Shift counts. Four numbers a worker can act on, each linking into
              the list already filtered to that group. */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            {[
              ['Up next', shift.queued.length, 'caution', IconClipboard],
              ['In progress', shift.active.length, 'neutral', IconClock],
              ['On hold', shift.held.length, 'neutral', IconClock],
              ['Awaiting review', shift.submitted.length, 'positive', IconCheckCircle],
            ].map(([label, value, tone, Icon]) => (
              <button
                key={label}
                onClick={() => navigate('/worker/tasks')}
                className="focus-ring lift bg-surface rounded-xl border border-line shadow-sm p-4 text-left hover:border-civic-300 transition-all"
              >
                <span className={`inline-flex w-9 h-9 rounded-xl items-center justify-center mb-2 ${
                  tone === 'positive' ? 'bg-teal-50 text-teal-700'
                  : tone === 'caution' ? 'bg-caution-50 text-caution-700'
                  : 'bg-civic-50 text-civic-700'}`}>
                  <Icon size={17} />
                </span>
                <div className="font-display text-[24px] font-bold text-ink leading-none tnum">{value}</div>
                <div className="text-[12px] text-ink-muted mt-1">{label}</div>
              </button>
            ))}
          </div>

          {/* Next up, ordered the same way the task list orders it. */}
          <section>
            <div className="flex items-baseline justify-between gap-2 mb-2.5">
              <h2 className="font-display text-[15px] font-bold text-ink">Up next</h2>
              <button
                onClick={() => navigate('/worker/tasks')}
                className="focus-ring text-[13px] font-semibold text-civic-700 hover:underline"
              >
                All tasks
              </button>
            </div>
            {shift.queued.length === 0 ? (
              <div className="bg-surface rounded-xl border border-line shadow-sm p-8 text-center">
                <IconCheckCircle size={22} className="text-teal-600 mx-auto mb-2" />
                <p className="text-[14px] text-ink-muted">Nothing waiting. You are clear.</p>
              </div>
            ) : (
              <ul className="bg-surface rounded-xl border border-line shadow-sm overflow-hidden divide-y divide-line">
                {shift.queued.slice(0, 5).map((t) => (
                  <li key={t.id}>
                    <button
                      onClick={() => navigate(`/worker/tasks/${t.id}`)}
                      className="focus-ring w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-surface-inset transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[14px] font-medium text-ink truncate">{t.issue}</div>
                        <div className="flex items-center gap-1.5 text-[12px] text-ink-muted mt-0.5">
                          <IconMapPin size={12} className="text-ink-faint shrink-0" />
                          <span className="truncate">{t.location}</span>
                        </div>
                      </div>
                      <SeverityBadge severity={t.severity} />
                      <StatusBadge status={t.status} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

        </>
      )}

    </div>
  );
}
