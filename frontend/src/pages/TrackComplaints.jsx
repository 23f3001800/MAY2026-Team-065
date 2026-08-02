// Track Complaints — a lifecycle view of the citizen's own reports, distinct
// from My Complaints (which is a searchable table). Backed by the same
// GET /complaints/, already scoped server-side to the signed-in citizen.
//
// The stepper only lights up the current stage. There is no status-history
// endpoint (see mappers.js / README "Gaps"), so intermediate timestamps for
// "when was it assigned" etc. don't exist -- only the current status and the
// last-updated timestamp are real.
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import SeverityBadge from '../components/dashboard/SeverityBadge';
import { LoadingPanel, ErrorPanel, EmptyPanel } from '../components/dashboard/AsyncStates';
import { IconMapPin, IconReport, IconCheckCircle, IconX } from '../components/dashboard/icons';
import { listComplaints } from '../api/complaints';
import useAsync from '../hooks/useAsync';

const STEPS = ['New', 'Assigned', 'Resolved'];

function formatStamp(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

function Stepper({ status }) {
  if (status === 'Rejected') {
    return (
      <div className="flex items-center gap-2 text-red-600">
        <span className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center shrink-0"><IconX size={13} /></span>
        <span className="text-[12px] font-semibold">Rejected</span>
      </div>
    );
  }
  const currentIndex = STEPS.indexOf(status);
  return (
    <div className="flex items-center">
      {STEPS.map((step, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <React.Fragment key={step}>
            <div className="flex flex-col items-center gap-1.5 w-20 shrink-0">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                  done || active ? 'bg-primary text-white' : 'bg-slate-100 text-slate-400'
                }`}
              >
                {done ? <IconCheckCircle size={13} /> : <span className="text-[11px] font-bold">{i + 1}</span>}
              </span>
              <span className={`text-[11px] font-medium text-center ${active ? 'text-slate-800' : 'text-slate-400'}`}>
                {step}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span className={`h-0.5 flex-1 -mt-5 ${i < currentIndex ? 'bg-primary' : 'bg-slate-100'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function TrackComplaints() {
  const { data, error, loading, refetch } = useAsync(() => listComplaints(), []);
  const items = useMemo(
    () => [...(data || [])].sort((a, b) => new Date(b.reportedAt) - new Date(a.reportedAt)),
    [data],
  );

  return (
    <div className="max-w-[900px] mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Track Complaints</h1>
          <p className="text-[14px] text-slate-500">Where each of your reports currently stands.</p>
        </div>
        <Link
          to="/report"
          className="inline-flex items-center gap-2 bg-primary hover:bg-emerald-600 text-white font-semibold text-[14px] px-4 py-2.5 rounded-xl shadow-btn transition-colors"
        >
          <IconReport size={16} /> Report Issue
        </Link>
      </div>

      {loading ? (
        <LoadingPanel label="Loading your complaints…" />
      ) : error ? (
        <ErrorPanel error={error} onRetry={refetch} />
      ) : items.length === 0 ? (
        <EmptyPanel
          title="No complaints yet"
          message="You haven't reported anything yet. When you do, its progress will show up here."
        />
      ) : (
        <ul className="space-y-3">
          {items.map((c) => (
            <li key={c.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
                <div className="min-w-0">
                  <Link to={`/complaints/${c.id}`} className="text-[15px] font-semibold text-slate-800 hover:text-primary transition-colors">
                    {c.issue}
                  </Link>
                  <div className="flex items-center gap-2 mt-1 text-[12px] text-slate-400 flex-wrap">
                    <span className="font-mono">{c.id}</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1"><IconMapPin size={12} /> {c.location}</span>
                    <span>·</span>
                    <span>Updated {formatStamp(c.updatedAt)}</span>
                  </div>
                </div>
                <SeverityBadge severity={c.severity} />
              </div>
              <Stepper status={c.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
