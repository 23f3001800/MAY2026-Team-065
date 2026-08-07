// Complaint Details — the full record behind one complaint.
//
// Three requests: GET /complaints/{id} for the record, /history for the audit
// trail, and /media for the photos. History and media load independently of the
// complaint, so a failure in either degrades that one panel instead of blanking
// the page.
//
// Still not readable from the backend: existing feedback. A rating submitted
// here shows until reload and then disappears, which the form says out loud.
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import StatusBadge from '../components/dashboard/StatusBadge';
import SeverityBadge from '../components/dashboard/SeverityBadge';
import { LoadingPanel, ErrorPanel } from '../components/dashboard/AsyncStates';
import PhotoGrid from '../components/dashboard/PhotoGrid';
import ReportSlipModal from '../components/dashboard/ReportSlipModal';
import ComplaintMap from '../components/map/ComplaintMap';
import {
  IconArrowLeft, IconMapPin, IconInbox, IconStar, IconBuilding, IconSend,
  IconCheckCircle, IconReport as IconFileText,
} from '../components/dashboard/icons';
import { getComplaint, getComplaintHistory, getComplaintMedia, submitFeedback } from '../api/complaints';
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

// Dot colour per lifecycle stage, matching StatusBadge's palette.
const DOT = {
  'New': 'bg-emerald-500',
  'Assigned': 'bg-amber-500',
  'In Progress': 'bg-blue-500',
  'Resolved': 'bg-violet-500',
  'Rejected': 'bg-red-500',
  'Closed': 'bg-slate-500',
};

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
  const [slipOpen, setSlipOpen] = useState(false);

  // History and media load beside the complaint rather than as part of it, so
  // one failing does not take out the page.
  const [history, setHistory] = useState([]);
  const [media, setMedia] = useState([]);
  const [sideError, setSideError] = useState('');

  useEffect(() => {
    let alive = true;
    Promise.allSettled([getComplaintHistory(id), getComplaintMedia(id)])
      .then(([h, m]) => {
        if (!alive) return;
        if (h.status === 'fulfilled') setHistory(h.value);
        if (m.status === 'fulfilled') setMedia(m.value);
        const failed = [h, m].filter((r) => r.status === 'rejected'
          && r.reason?.name !== 'SessionExpiredError');
        if (failed.length) setSideError(failed[0].reason?.message || 'Could not load attachments.');
      });
    return () => { alive = false; };
  }, [id]);

  // Oldest first — a timeline reads top-down in the order things happened.
  const timeline = useMemo(
    () => [...history].sort((a, b) => new Date(a.at) - new Date(b.at)),
    [history],
  );

  // Photos uploaded at or after the complaint was marked Resolved are the field
  // worker's completion evidence. Splitting on the resolution timestamp is a
  // heuristic, but the media response carries no role — only an uploader id we
  // cannot resolve to a name — so this is the honest signal available.
  const resolvedAt = useMemo(() => {
    const entry = history.find((h) => h.status === 'Resolved');
    return entry ? new Date(entry.at).getTime() : null;
  }, [history]);

  const { reportPhotos, resolutionPhotos } = useMemo(() => {
    const report = [];
    const resolution = [];
    for (const m of media) {
      const at = m.uploadedAt ? new Date(m.uploadedAt).getTime() : 0;
      if (resolvedAt && at >= resolvedAt) resolution.push(m);
      else report.push(m);
    }
    return { reportPhotos: report, resolutionPhotos: resolution };
  }, [media, resolvedAt]);

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

        {/* The digital acknowledgement the citizen is entitled to on filing. */}
        <button
          onClick={() => setSlipOpen(true)}
          className="focus-ring lift inline-flex items-center gap-2 bg-white border border-line text-ink-body hover:border-primary hover:text-primary font-semibold text-[13px] px-3.5 py-2 rounded-xl shadow-sm transition-all"
        >
          <IconFileText size={15} /> Acknowledgement slip
        </button>
      </div>

      {slipOpen && <ReportSlipModal complaintId={complaint.id} onDismiss={() => setSlipOpen(false)} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-2 space-y-5">
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="font-semibold text-slate-800 text-[15px] mb-2">Description</h2>
            <p className="text-[14px] text-slate-600 leading-relaxed whitespace-pre-line">{complaint.description}</p>

            {reportPhotos.length > 0 && (
              <>
                <h3 className="font-semibold text-slate-800 text-[15px] mt-6 mb-3">Photo Evidence</h3>
                <PhotoGrid photos={reportPhotos} />
              </>
            )}
          </section>

          {/* Where it is. Shown to whoever can open the complaint — citizen,
              officer, worker or admin all need to place it. */}
          {complaint.coords && (
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h2 className="font-semibold text-slate-800 text-[15px] mb-3">Location</h2>
              <ComplaintMap complaints={[complaint]} height="300px" />
            </section>
          )}

          {/* Resolution evidence — the field worker's completion proof. */}
          {resolutionPhotos.length > 0 && (
            <section className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-primary"><IconCheckCircle size={18} /></span>
                <h2 className="font-semibold text-slate-800 text-[15px]">Resolution Evidence</h2>
              </div>
              <PhotoGrid photos={resolutionPhotos} />
            </section>
          )}

          {sideError && (
            <p className="text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Some attachments could not be loaded: {sideError}
            </p>
          )}

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
            <h2 className="font-semibold text-slate-800 text-[15px] mb-4">Status Timeline</h2>

            {timeline.length === 0 ? (
              <p className="text-[13px] text-slate-500">
                No transitions recorded yet — this complaint has not moved since it was filed
                on {formatStamp(complaint.reportedAt)}.
              </p>
            ) : (
              <ol className="relative">
                {timeline.map((entry, i) => (
                  <li
                    key={entry.id}
                    style={{ '--i': i }}
                    className="relative pl-7 pb-5 last:pb-0 animate-rise-in stagger"
                  >
                    {i < timeline.length - 1 && (
                      <span className="absolute left-[7px] top-4 bottom-0 w-px bg-slate-200" aria-hidden="true" />
                    )}
                    <span className={`absolute left-0 top-1 w-[15px] h-[15px] rounded-full border-2 border-white ring-2 ring-slate-100 ${DOT[entry.status] || 'bg-slate-400'}`} />
                    <div className="text-[13px] font-semibold text-slate-800">{entry.status}</div>
                    <div className="text-[12px] text-slate-400">{formatStamp(entry.at)}</div>
                    {entry.remarks && (
                      <p className="text-[13px] text-slate-600 mt-1 leading-snug">{entry.remarks}</p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
