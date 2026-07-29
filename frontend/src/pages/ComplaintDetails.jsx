// Complaint Details — the full record behind one complaint: what was reported,
// every status transition with its timestamp and actor, the field worker's
// resolution evidence, and the citizen's rating once it is resolved.
// Data is mocked; submitting feedback updates local state only.
import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import StatusBadge from '../components/dashboard/StatusBadge';
import SeverityBadge from '../components/dashboard/SeverityBadge';
import PhotoTile from '../components/dashboard/PhotoTile';
import {
  IconArrowLeft, IconMapPin, IconInbox, IconCheckCircle, IconStar,
  IconUserCircle, IconBuilding, IconSend,
} from '../components/dashboard/icons';
import { getComplaintDetail } from '../data/mockComplaintDetails';

function formatStamp(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

// Dot colour per lifecycle stage, matching StatusBadge's palette.
const DOT = {
  'New': 'bg-emerald-500',
  'Assigned': 'bg-amber-500',
  'In Progress': 'bg-blue-500',
  'Resolved': 'bg-violet-500',
  'Rejected': 'bg-red-500',
};

function StarRating({ value, onChange, readOnly = false }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="flex items-center gap-1" role={readOnly ? 'img' : 'radiogroup'}
         aria-label={readOnly ? `Rated ${value} out of 5` : 'Rating'}>
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
          <span className={n <= shown ? 'fill-current' : ''}>
            <IconStar size={readOnly ? 18 : 26} />
          </span>
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
  const complaint = useMemo(() => getComplaintDetail(id), [id]);

  // Local-only feedback state, seeded from the mock record.
  const [feedback, setFeedback] = useState(complaint?.feedback || null);
  const [rating, setRating] = useState(0);
  const [comments, setComments] = useState('');
  const [error, setError] = useState('');

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

  const submitFeedback = (e) => {
    e.preventDefault();
    if (!rating) {
      setError('Please choose a star rating.');
      return;
    }
    setError('');
    setFeedback({ rating, comments: comments.trim(), submittedAt: new Date().toISOString() });
  };

  return (
    <div className="max-w-[1200px] mx-auto space-y-5">
      <Link to="/my-complaints" className="inline-flex items-center gap-2 text-[13px] font-medium text-slate-500 hover:text-primary transition-colors">
        <IconArrowLeft size={16} /> Back to My Complaints
      </Link>

      {/* Header */}
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
        {/* Main column */}
        <div className="lg:col-span-2 space-y-5">
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="font-semibold text-slate-800 text-[15px] mb-2">Description</h2>
            <p className="text-[14px] text-slate-600 leading-relaxed">{complaint.description}</p>

            <h3 className="font-semibold text-slate-800 text-[15px] mt-6 mb-3">Photo Evidence</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {complaint.photoCaptions.map((caption) => (
                <PhotoTile key={caption} caption={caption} />
              ))}
            </div>
          </section>

          {/* Resolution evidence from the field worker */}
          {complaint.resolution && (
            <section className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-primary"><IconCheckCircle size={18} /></span>
                <h2 className="font-semibold text-slate-800 text-[15px]">Resolution Evidence</h2>
              </div>
              <p className="text-[14px] text-slate-600 leading-relaxed">{complaint.resolution.remarks}</p>
              <p className="text-[12px] text-slate-400 mt-2">
                Resolved by {complaint.resolution.resolvedBy} · {formatStamp(complaint.resolution.resolvedAt)}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                {complaint.resolution.photoCaptions.map((caption) => (
                  <PhotoTile key={caption} caption={caption} tone="resolution" />
                ))}
              </div>
            </section>
          )}

          {/* Feedback: show the submitted rating, or collect one. */}
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
                  <p className="text-[12px] text-slate-400 mt-2">
                    Submitted {formatStamp(feedback.submittedAt)}
                  </p>
                </div>
              ) : (
                <form onSubmit={submitFeedback} className="space-y-4">
                  <p className="text-[14px] text-slate-500">
                    How satisfied are you with how this was handled?
                  </p>
                  <StarRating value={rating} onChange={(n) => { setRating(n); setError(''); }} />
                  <textarea
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    rows={3}
                    placeholder="Add a comment (optional)…"
                    className="w-full rounded-xl border border-slate-200 p-3.5 text-[14px] text-slate-800 outline-none resize-y focus:border-primary focus:ring-2 focus:ring-emerald-100 transition"
                  />
                  {error && <p className="text-[13px] font-medium text-red-600">{error}</p>}
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 bg-primary hover:bg-emerald-600 text-white font-semibold text-[14px] px-4 py-2.5 rounded-xl shadow-btn transition-colors"
                  >
                    <IconSend size={16} /> Submit Feedback
                  </button>
                </form>
              )}
            </section>
          )}
        </div>

        {/* Side column */}
        <div className="space-y-5">
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h2 className="font-semibold text-slate-800 text-[15px] mb-2">Details</h2>
            <div className="divide-y divide-slate-100">
              <SummaryRow icon={IconInbox} label="Category">{complaint.category}</SummaryRow>
              <SummaryRow icon={IconMapPin} label="Location">{complaint.location}</SummaryRow>
              <SummaryRow icon={IconBuilding} label="Department">{complaint.department}</SummaryRow>
              <SummaryRow icon={IconUserCircle} label="Assigned To">
                {complaint.assignedTo || <span className="text-slate-400">Not yet assigned</span>}
              </SummaryRow>
            </div>
          </section>

          {/* Audit trail */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h2 className="font-semibold text-slate-800 text-[15px] mb-4">Status Timeline</h2>
            <ol className="relative">
              {complaint.timeline.map((entry, i) => {
                const last = i === complaint.timeline.length - 1;
                return (
                  <li key={entry.status} className="relative pl-7 pb-5 last:pb-0">
                    {!last && <span className="absolute left-[7px] top-4 bottom-0 w-px bg-slate-200" aria-hidden="true" />}
                    <span className={`absolute left-0 top-1 w-[15px] h-[15px] rounded-full border-2 border-white ring-2 ring-slate-100 ${DOT[entry.status] || 'bg-slate-400'}`} />
                    <div className="text-[13px] font-semibold text-slate-800">{entry.status}</div>
                    <div className="text-[12px] text-slate-400">{formatStamp(entry.at)}</div>
                    <p className="text-[13px] text-slate-600 mt-1 leading-snug">{entry.remarks}</p>
                    <div className="text-[12px] text-slate-400 mt-0.5">by {entry.actor}</div>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
