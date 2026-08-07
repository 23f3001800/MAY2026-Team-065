// Feedback — every resolved complaint in one place, so a citizen doesn't have
// to hunt through My Complaints to rate one.
//
// Backed by GET /complaints/ (already scoped to the citizen) filtered to
// RESOLVED, and POST /complaints/{id}/feedback for the actual submission --
// same call ComplaintDetails uses. There is no GET for existing feedback, so
// "already rated" is tracked for this session only, exactly like
// ComplaintDetails does; submitting twice would create a second row
// server-side, which is why a rated card locks immediately.
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LoadingPanel, ErrorPanel, EmptyPanel } from '../components/dashboard/AsyncStates';
import { IconStar, IconSend, IconCheckCircle, IconInbox } from '../components/dashboard/icons';
import { listComplaints, submitFeedback } from '../api/complaints';
import useAsync from '../hooks/useAsync';

function StarRating({ value, onChange }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          aria-pressed={value === n}
          className={`transition-colors cursor-pointer ${n <= shown ? 'text-amber-400' : 'text-slate-300'}`}
        >
          <IconStar size={22} />
        </button>
      ))}
    </div>
  );
}

function FeedbackCard({ complaint, onSubmitted }) {
  const [rating, setRating] = useState(0);
  const [comments, setComments] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null);

  const submit = async () => {
    if (!rating) { setError('Choose a star rating first.'); return; }
    setError('');
    setSaving(true);
    try {
      const result = await submitFeedback(complaint.id, { rating, comments: comments.trim() });
      setSaved(result);
      onSubmitted(complaint.id);
    } catch (err) {
      if (err.name !== 'SessionExpiredError') setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-5 flex items-start gap-3">
        <span className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
          <IconCheckCircle size={18} />
        </span>
        <div>
          <div className="text-[14px] font-semibold text-slate-800">Thanks for rating {complaint.id}</div>
          <div className="text-[13px] text-slate-500 mt-0.5">{saved.rating} star{saved.rating > 1 ? 's' : ''} submitted.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
      <div>
        <Link to={`/complaints/${complaint.id}`} className="text-[14px] font-semibold text-slate-800 hover:text-primary transition-colors">
          {complaint.issue}
        </Link>
        <div className="text-[12px] text-slate-400 mt-0.5">{complaint.id} · {complaint.category} · {complaint.location}</div>
      </div>
      <StarRating value={rating} onChange={(n) => { setRating(n); setError(''); }} />
      <textarea
        value={comments}
        onChange={(e) => setComments(e.target.value)}
        rows={2}
        placeholder="Add a comment (optional)…"
        className="w-full rounded-lg border border-slate-200 p-2.5 text-[13px] text-slate-800 outline-none resize-y focus:border-primary transition"
      />
      {error && <p className="text-[13px] font-medium text-red-600">{error}</p>}
      <button
        onClick={submit}
        disabled={saving}
        className="inline-flex items-center gap-2 bg-primary hover:bg-emerald-600 disabled:opacity-60 text-white font-semibold text-[13px] px-3.5 py-2 rounded-lg shadow-btn transition-colors"
      >
        <IconSend size={14} /> {saving ? 'Submitting…' : 'Submit Feedback'}
      </button>
    </div>
  );
}

export default function Feedback() {
  const { data, error, loading, refetch } = useAsync(() => listComplaints(), []);
  const [ratedIds, setRatedIds] = useState(() => new Set());

  const resolved = useMemo(
    () => (data || []).filter((c) => c.status === 'Resolved' && !ratedIds.has(c.id)),
    [data, ratedIds],
  );

  return (
    <div className="max-w-[760px] mx-auto space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Feedback</h1>
        <p className="text-[14px] text-slate-500">Rate how resolved complaints were handled.</p>
      </div>

      {loading ? (
        <LoadingPanel label="Loading resolved complaints…" variant="cards" />
      ) : error ? (
        <ErrorPanel error={error} onRetry={refetch} />
      ) : resolved.length === 0 ? (
        <EmptyPanel
          icon={IconInbox}
          title="Nothing to rate right now"
          message="Resolved complaints without feedback yet will show up here."
        />
      ) : (
        <div className="space-y-4">
          {resolved.map((c) => (
            <FeedbackCard
              key={c.id}
              complaint={c}
              onSubmitted={(id) => setRatedIds((s) => new Set(s).add(id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
