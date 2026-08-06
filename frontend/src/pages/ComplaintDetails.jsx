// Complaint Details — the full record behind one complaint.
//
// Backed by GET /complaints/{id}. Note what that response does NOT include:
// status history, media, assigned worker, or existing feedback. The backend
// stores status history and media, but exposes no endpoint to read them, so
// those sections are honestly marked unavailable rather than faked.
// TODO(raja-api): GET /complaints/{id}/history, /media, /feedback.
import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import StatusBadge from '../components/dashboard/StatusBadge';
import SeverityBadge from '../components/dashboard/SeverityBadge';
import { LoadingPanel, ErrorPanel } from '../components/dashboard/AsyncStates';
import {
  IconArrowLeft, IconMapPin, IconInbox, IconStar, IconBuilding, IconSend, IconClock,
} from '../components/dashboard/icons';
import { getComplaint, submitFeedback } from '../api/complaints';
import useAsync from '../hooks/useAsync';

function formatStamp(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function StarRating({ value, onChange, readOnly = false }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div
      className="flex items-center gap-1"
      role={readOnly ? 'img' : 'radiogroup'}
      aria-label={readOnly ? `Rated ${value} out of 5` : 'Rating'}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(n)}
          onMouseEnter={() => !readOnly && setHover(n)}
          onMouseLeave={() => !readOnly && setHover(0)}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          aria-pressed={!readOnly && value === n}
          className={`transition-colors ${readOnly ? 'cursor-default' : 'cursor-pointer'} ${
            n <= shown ? 'text-amber-400' : 'text-slate-300'
          }`}
        >
          <IconStar size={readOnly ? 18 : 26} />
        </button>
      ))}
    </div>
  );
}

function SummaryRow({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className="text-slate-400 mt-0.5 shrink-0"><Icon size={16} /></span>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
        <div className="text-[13px] text-slate-700 font-medium">{children}</div>
      </div>
    </div>
  );
}

export default function ComplaintDetails() {
  const { id } = useParams();
  const { data: complaint, error, loading, refetch } = useAsync(() => getComplaint(id), [id]);

  const [feedback, setFeedback] = useState(null);
  const [rating, setRating] = useState(0);
  const [comments, setComments] = useState('');
  const [feedbackError, setFeedbackError] = useState('');
  const [saving, setSaving] = useState(false);

  // What the response does tell us about timing, presented as a two-point
  // timeline rather than a fabricated lifecycle.
  const timeline = useMemo(() => {
    if (!complaint) return [];
    const entries = [{ label: 'Reported', at: complaint.reportedAt }];
    if (complaint.updatedAt && complaint.updatedAt !== complaint.reportedAt) {
      entries.push({ label: `Updated — now ${complaint.status}`, at: complaint.updatedAt });
    }
    return entries;
  }, [complaint]);

  if (loading) {
    return <div className="max-w-[1200px] mx-auto"><LoadingPanel label="Loading complaint…" variant="detail" /></div>;
  }

  if (error) {
    return (
      <div className="max-w-[1200px] mx-auto space-y-4">
        <Link to="/my-complaints" className="inline-flex items-center gap-2 text-[13px] font-medium text-slate-500 hover:text-primary">
          <IconArrowLeft size={16} /> Back to My Complaints
        </Link>
        <ErrorPanel error={error} onRetry={refetch} />
      </div>
    );
  }

  if (!complaint) {
    return (
      <div className="max-w-[1200px] mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-4">
            <IconInbox size={26} />
          </div>
          <h1 className="font-display font-bold text-slate-800 text-lg">Complaint not found</h1>
          <p className="text-[14px] text-slate-500 mt-1">
            No complaint matches <span className="font-mono">{id}</span>.
          </p>
          <Link to="/my-complaints" className="mt-5 inline-flex items-center gap-2 text-[14px] font-semibold text-primary hover:underline">
            <IconArrowLeft size={16} /> Back to My Complaints
          </Link>
        </div>
      </div>
    );
  }

  const handleFeedback = async (e) => {
    e.preventDefault();
    if (!rating) {
      setFeedbackError('Please choose a star rating.');
      return;
    }
    setFeedbackError('');
    setSaving(true);
    try {
      const saved = await submitFeedback(complaint.id, { rating, comments: comments.trim() });
      setFeedback(saved);
    } catch (err) {
      if (err.name !== 'SessionExpiredError') setFeedbackError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto space-y-5">
      <Link to="/my-complaints" className="inline-flex items-center gap-2 text-[13px] font-medium text-slate-500 hover:text-primary transition-colors">
        <IconArrowLeft size={16} /> Back to My Complaints
      </Link>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">{complaint.issue}</h1>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-[12px] font-mono text-slate-400">{complaint.id}</span>
            <span className="text-slate-300">·</span>
            <StatusBadge status={complaint.status} />
            <SeverityBadge severity={complaint.severity} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-2 space-y-5">
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="font-semibold text-slate-800 text-[15px] mb-2">Description</h2>
            <p className="text-[14px] text-slate-600 leading-relaxed whitespace-pre-line">{complaint.description}</p>
          </section>

          {/* Feedback — the backend accepts it only for RESOLVED complaints. */}
          {complaint.status === 'Resolved' && (
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h2 className="font-semibold text-slate-800 text-[15px] mb-3">
                {feedback ? 'Your Feedback' : 'Rate this resolution'}
              </h2>

              {feedback ? (
                <div>
                  <StarRating value={feedback.rating} readOnly />
                  {feedback.comments && (
                    <p className="text-[14px] text-slate-600 leading-relaxed mt-3">“{feedback.comments}”</p>
                  )}
                  <p className="text-[12px] text-slate-400 mt-2">Submitted {formatStamp(feedback.submittedAt)}</p>
                </div>
              ) : (
                <form onSubmit={handleFeedback} className="space-y-4">
                  <p className="text-[14px] text-slate-500">How satisfied are you with how this was handled?</p>
                  <StarRating value={rating} onChange={(n) => { setRating(n); setFeedbackError(''); }} />
                  <textarea
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    rows={3}
                    placeholder="Add a comment (optional)…"
                    className="w-full rounded-xl border border-slate-200 p-3.5 text-[14px] text-slate-800 outline-none resize-y focus:border-primary focus:ring-2 focus:ring-emerald-100 transition"
                  />
                  {feedbackError && <p className="text-[13px] font-medium text-red-600">{feedbackError}</p>}
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 bg-primary hover:bg-emerald-600 disabled:opacity-60 text-white font-semibold text-[14px] px-4 py-2.5 rounded-xl shadow-btn transition-colors"
                  >
                    <IconSend size={16} /> {saving ? 'Submitting…' : 'Submit Feedback'}
                  </button>
                  <p className="text-[12px] text-slate-400">
                    Existing feedback cannot be shown yet — the backend has no endpoint to read it
                    back, so submitting twice will create a second entry.
                  </p>
                </form>
              )}
            </section>
          )}
        </div>

        <div className="space-y-5">
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h2 className="font-semibold text-slate-800 text-[15px] mb-2">Details</h2>
            <div className="divide-y divide-slate-100">
              <SummaryRow icon={IconInbox} label="Category">{complaint.category}</SummaryRow>
              <SummaryRow icon={IconMapPin} label="Location">
                {complaint.location}
                {complaint.coords && (
                  <span className="block text-[11px] font-normal text-slate-400 mt-0.5">
                    {complaint.coords.latitude.toFixed(5)}, {complaint.coords.longitude.toFixed(5)}
                  </span>
                )}
              </SummaryRow>
              <SummaryRow icon={IconBuilding} label="Department">
                {complaint.department || <span className="text-slate-400">Unassigned</span>}
              </SummaryRow>
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h2 className="font-semibold text-slate-800 text-[15px] mb-4">Timeline</h2>
            <ol className="relative">
              {timeline.map((entry, i) => (
                <li key={entry.label} className="relative pl-7 pb-5 last:pb-0">
                  {i < timeline.length - 1 && (
                    <span className="absolute left-[7px] top-4 bottom-0 w-px bg-slate-200" aria-hidden="true" />
                  )}
                  <span className="absolute left-0 top-1 w-[15px] h-[15px] rounded-full border-2 border-white ring-2 ring-slate-100 bg-primary" />
                  <div className="text-[13px] font-semibold text-slate-800">{entry.label}</div>
                  <div className="text-[12px] text-slate-400">{formatStamp(entry.at)}</div>
                </li>
              ))}
            </ol>
            <p className="flex items-start gap-2 text-[12px] text-slate-400 border-t border-slate-100 pt-3 mt-1">
              <IconClock size={13} className="mt-0.5 shrink-0" />
              The full transition history is recorded by the backend but not yet readable, so only
              the first and last events are shown.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
