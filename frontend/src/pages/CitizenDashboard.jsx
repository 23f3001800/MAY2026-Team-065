// Citizen home.
//
// A citizen is not running an operation — they have a handful of complaints and
// one question: "what is happening with mine?" So this leads with the thing
// that changed most recently and the one that has been waiting longest, and
// keeps the charts to what a person with four complaints can actually read.
//
// Backed by GET /complaints/, already scoped server-side to the signed-in
// citizen. Aggregation is shared with the officer and admin views via
// lib/complaintMetrics so "resolved" means the same thing everywhere.
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import StatusBadge from '../components/dashboard/StatusBadge';
import { Donut } from '../components/charts';
import { LoadingPanel, ErrorPanel } from '../components/dashboard/AsyncStates';
import {
  IconReport, IconArrowRight, IconClock, IconCheckCircle, IconMapPin, IconStar,
} from '../components/dashboard/icons';
import { listComplaints } from '../api/complaints';
import { computeMetrics, ranked } from '../lib/complaintMetrics';
import { TERMINAL_STATUSES } from '../api/mappers';
import { getCurrentUser } from '../api/auth';
import useAsync from '../hooks/useAsync';

const DAY_MS = 86400000;

function ageDays(iso) {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : Math.floor((Date.now() - t) / DAY_MS);
}

// Same five-stage collapse the complaints list uses — ten backend states are
// more than a citizen needs to track.
const STAGES = ['Reported', 'Reviewed', 'Assigned', 'Fixed', 'Confirmed'];
function stageIndex(status) {
  switch (status) {
    case 'New': return 0;
    case 'Under Review': return 1;
    case 'Assigned': case 'In Progress': case 'On Hold': case 'Escalated': return 2;
    case 'Resolved': return 3;
    case 'Verified': return 4;
    default: return 1;
  }
}

// The headline card: one complaint, its progress, and what happens next.
function FocusCard({ complaint }) {
  const current = stageIndex(complaint.status);
  const days = ageDays(complaint.reportedAt);
  const rejected = complaint.status === 'Rejected';

  return (
    <Link
      to={`/complaints/${complaint.id}`}
      className="focus-ring lift group block bg-surface rounded-2xl border border-line shadow-sm p-5 hover:shadow-md hover:border-civic-300 transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted mb-1">
            Most recent
          </div>
          <h2 className="font-display text-[19px] font-bold text-ink leading-snug">
            {complaint.issue}
          </h2>
        </div>
        <StatusBadge status={complaint.status} />
      </div>

      <div className="flex items-center gap-1.5 text-[13px] text-ink-muted mt-2">
        <IconMapPin size={13} className="text-ink-faint" />
        <span className="truncate">{complaint.location}</span>
      </div>

      {/* Progress rail — the "where is it" answer without opening anything. */}
      <div className="mt-4">
        <div className="flex items-center gap-1">
          {STAGES.map((label, i) => (
            <span
              key={label}
              className={`h-2 flex-1 rounded-full transition-colors ${
                rejected ? 'bg-danger-100'
                  : i < current ? 'bg-teal-500'
                  : i === current ? 'bg-civic-600'
                  : 'bg-line'
              }`}
            />
          ))}
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className={`text-[12px] font-semibold ${rejected ? 'text-danger-600' : 'text-civic-700'}`}>
            {rejected ? 'Closed without action' : STAGES[current]}
          </span>
          <span className="text-[12px] text-ink-faint inline-flex items-center gap-1">
            {days === 0 ? 'reported today' : `${days}d ago`}
            <IconArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

function MiniStat({ label, value, tone = 'neutral', icon: Icon }) {
  const tones = {
    neutral: 'bg-civic-50 text-civic-700',
    positive: 'bg-teal-50 text-teal-700',
    caution: 'bg-caution-50 text-caution-700',
  };
  return (
    <div className="bg-surface rounded-xl border border-line shadow-sm p-4 flex items-center gap-3">
      <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tones[tone]}`}>
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <div className="font-display text-[22px] font-bold text-ink leading-none tnum">{value}</div>
        <div className="text-[12px] text-ink-muted mt-0.5">{label}</div>
      </div>
    </div>
  );
}

export default function CitizenDashboard() {
  const user = getCurrentUser();
  const { data, error, loading, refetch } = useAsync(() => listComplaints(), []);
  const complaints = useMemo(() => data || [], [data]);
  const metrics = useMemo(() => computeMetrics(complaints), [complaints]);

  const newest = useMemo(
    () => [...complaints].sort((a, b) => new Date(b.reportedAt) - new Date(a.reportedAt))[0] || null,
    [complaints],
  );

  // The one that has been waiting longest and is still open — the complaint a
  // citizen is most likely to be wondering about, and the one worth chasing.
  const longestWaiting = useMemo(() => {
    const open = complaints
      .filter((c) => !TERMINAL_STATUSES.includes(c.status) && c.id !== newest?.id)
      .sort((a, b) => new Date(a.reportedAt) - new Date(b.reportedAt));
    return open[0] || null;
  }, [complaints, newest]);

  // Resolved but not yet confirmed by the citizen — an action only they can take.
  const awaitingConfirmation = useMemo(
    () => complaints.filter((c) => c.status === 'Resolved'),
    [complaints],
  );

  const firstName = (user?.name || 'there').split(' ')[0];

  if (loading) return <div className="max-w-[1100px] mx-auto"><LoadingPanel label="Loading your complaints…" variant="stats" /></div>;
  if (error) return <div className="max-w-[1100px] mx-auto"><ErrorPanel error={error} onRetry={refetch} /></div>;

  return (
    <div className="max-w-[1100px] mx-auto space-y-5 animate-rise-in">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-[26px] font-bold text-ink leading-tight">
            Hello, {firstName}
          </h1>
          <p className="text-[14px] text-ink-muted mt-1">
            {complaints.length === 0
              ? 'Report something that needs fixing in your area.'
              : `${metrics.open} of your ${complaints.length} complaints still open.`}
          </p>
        </div>
        <Link
          to="/report"
          className="focus-ring lift inline-flex items-center gap-2 bg-civic-700 hover:bg-civic-800 text-white font-semibold text-[14px] px-4 py-2.5 rounded-xl shadow-sm transition-all"
        >
          <IconReport size={16} /> Report an issue
        </Link>
      </header>

      {complaints.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-line shadow-sm p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-civic-50 text-civic-700 flex items-center justify-center mx-auto mb-4">
            <IconReport size={26} />
          </div>
          <h2 className="font-display text-[18px] font-bold text-ink">Nothing reported yet</h2>
          <p className="text-[14px] text-ink-muted mt-1.5 max-w-sm mx-auto leading-relaxed">
            A pothole, an overflowing bin, a streetlight that has been out for weeks — report it and
            we will route it to the right department.
          </p>
          <Link
            to="/report"
            className="focus-ring lift inline-flex items-center gap-2 mt-5 bg-civic-700 hover:bg-civic-800 text-white font-semibold text-[14px] px-5 py-2.5 rounded-xl transition-all"
          >
            <IconReport size={16} /> Report your first issue
          </Link>
        </div>
      ) : (
        <>
          {/* Something only the citizen can do — surfaced above everything else,
              because nobody else can clear it. */}
          {awaitingConfirmation.length > 0 && (
            <div className="bg-teal-50 border border-teal-100 rounded-xl p-4 flex items-start gap-3 flex-wrap">
              <span className="w-9 h-9 rounded-xl bg-surface text-teal-700 flex items-center justify-center shrink-0">
                <IconStar size={17} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-semibold text-ink">
                  {awaitingConfirmation.length === 1
                    ? 'A complaint has been marked fixed'
                    : `${awaitingConfirmation.length} complaints have been marked fixed`}
                </div>
                <p className="text-[13px] text-ink-body mt-0.5 leading-snug">
                  Confirm the work and rate it — nobody else can close these for you.
                </p>
              </div>
              <Link
                to={`/complaints/${awaitingConfirmation[0].id}`}
                className="focus-ring shrink-0 inline-flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-[13px] px-3.5 py-2 rounded-lg transition-colors"
              >
                Review <IconArrowRight size={14} />
              </Link>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
            <div className="lg:col-span-2 space-y-4">
              {newest && <FocusCard complaint={newest} />}

              {longestWaiting && (
                <Link
                  to={`/complaints/${longestWaiting.id}`}
                  className="focus-ring lift group block bg-surface rounded-xl border border-line shadow-sm p-4 hover:border-caution-500/40 transition-all"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <IconClock size={13} className="text-caution-600" />
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-caution-700">
                      Waiting longest · {ageDays(longestWaiting.reportedAt)} days
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold text-ink leading-snug">{longestWaiting.issue}</div>
                      <div className="text-[12px] text-ink-muted mt-0.5 truncate">{longestWaiting.location}</div>
                    </div>
                    <StatusBadge status={longestWaiting.status} />
                  </div>
                </Link>
              )}

              <Link
                to="/complaints"
                className="focus-ring flex items-center justify-between gap-2 bg-surface rounded-xl border border-line shadow-sm px-4 py-3 hover:border-civic-300 transition-colors group"
              >
                <span className="text-[13px] font-semibold text-ink-body">
                  See all {complaints.length} complaints
                </span>
                <IconArrowRight size={15} className="text-ink-faint transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
                <MiniStat label="Still open" value={metrics.open} tone="caution" icon={IconClock} />
                <MiniStat label="Resolved" value={metrics.resolved} tone="positive" icon={IconCheckCircle} />
              </div>

              {/* Only worth drawing once there is a mix to show. With two
                  complaints a donut is decoration. */}
              {complaints.length >= 3 && (
                <section className="bg-surface rounded-xl border border-line shadow-sm p-4">
                  <h2 className="font-display text-[14px] font-bold text-ink mb-3">What you report</h2>
                  <Donut
                    data={ranked(metrics.byCategory, 5).top}
                    size={140}
                    thickness={22}
                    centerLabel="complaints"
                  />
                </section>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
