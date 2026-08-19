// Feedback — every resolved complaint in one place, so a citizen doesn't have
// to hunt through My Complaints to rate one.
//
// Backed by GET /complaints/ (already scoped to the citizen) and
// GET|POST /complaints/{id}/feedback.
//
// The page has two halves, and it used to have only the first: work waiting to
// be rated, and ratings already given. Existing feedback is read back now, so a
// rating survives a reload and stays visible after the complaint is verified --
// previously it vanished the moment the citizen confirmed the fix, because the
// only place it appeared was gated on the complaint still being Resolved.
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LoadingPanel, ErrorPanel, EmptyPanel } from '../components/dashboard/AsyncStates';
import { IconStar, IconSend, IconCheckCircle, IconInbox } from '../components/dashboard/icons';
import { getComplaintFeedback, listComplaints, submitFeedback } from '../api/complaints';
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

  // Ratings already given, keyed by complaint. Fetched per complaint because
  // there is no bulk feedback endpoint; the list is a citizen's own complaints,
  // so it is tens of rows at most.
  const [given, setGiven] = useState({});

  const complaints = useMemo(() => data || [], [data]);

  useEffect(() => {
    // Only complaints that could have been rated: work has to be finished
    // first, and anything Verified was rated-then-confirmed or confirmed alone.
    const candidates = complaints.filter((c) => ['Resolved', 'Verified'].includes(c.status));
    if (!candidates.length) return undefined;

    let alive = true;
    Promise.allSettled(candidates.map((c) => getComplaintFeedback(c.id)))
      .then((results) => {
        if (!alive) return;
        const next = {};
        results.forEach((r, i) => {
          if (r.status === 'fulfilled' && r.value?.length) {
            next[candidates[i].id] = r.value[0];
          }
        });
        setGiven(next);
      });
    return () => { alive = false; };
  }, [complaints]);

  // Waiting on the citizen: finished work with no rating yet.
  const awaiting = useMemo(
    () => complaints.filter(
      (c) => ['Resolved', 'Verified'].includes(c.status)
        && !given[c.id] && !ratedIds.has(c.id),
    ),
    [complaints, given, ratedIds],
  );

  const rated = useMemo(
    () => complaints
      .filter((c) => given[c.id])
      .sort((a, b) => new Date(given[b.id].submittedAt) - new Date(given[a.id].submittedAt)),
    [complaints, given],
  );

  return (
    <div className="max-w-[760px] mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Feedback</h1>
        <p className="text-[14px] text-ink-muted">
          Rate how your complaints were handled, and see what you have already said.
        </p>
      </div>

      {loading ? (
        <LoadingPanel label="Loading your complaints…" variant="cards" />
      ) : error ? (
        <ErrorPanel error={error} onRetry={refetch} />
      ) : (
        <>
          <section>
            <h2 className="font-display text-[15px] font-bold text-ink mb-3">
              Waiting for your rating
              {awaiting.length > 0 && (
                <span className="ml-2 text-[12px] font-semibold text-ink-faint tnum">
                  {awaiting.length}
                </span>
              )}
            </h2>
            {awaiting.length === 0 ? (
              <EmptyPanel
                icon={IconInbox}
                title="Nothing to rate right now"
                message="When work on one of your complaints is finished, it will appear here."
              />
            ) : (
              <div className="space-y-4">
                {awaiting.map((c) => (
                  <FeedbackCard
                    key={c.id}
                    complaint={c}
                    onSubmitted={(id) => setRatedIds((s2) => new Set(s2).add(id))}
                  />
                ))}
              </div>
            )}
          </section>

          {/* What they already said. This is the half that was missing: a
              rating used to be write-only from the citizen's point of view. */}
          {rated.length > 0 && (
            <section>
              <h2 className="font-display text-[15px] font-bold text-ink mb-3">
                Ratings you have given
                <span className="ml-2 text-[12px] font-semibold text-ink-faint tnum">
                  {rated.length}
                </span>
              </h2>
              <ul className="space-y-3">
                {rated.map((c) => {
                  const f = given[c.id];
                  return (
                    <li
                      key={c.id}
                      className="bg-surface rounded-xl border border-line shadow-sm p-4"
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <Link
                            to={`/complaints/${c.id}`}
                            className="focus-ring rounded text-[14px] font-semibold text-ink hover:text-civic-700 hover:underline"
                          >
                            {c.issue}
                          </Link>
                          <p className="text-[11.5px] font-mono text-ink-faint mt-0.5">{c.id}</p>
                        </div>
                        <span
                          className="inline-flex items-center gap-0.5 shrink-0"
                          aria-label={`${f.rating} out of 5`}
                        >
                          {[1, 2, 3, 4, 5].map((n) => (
                            <span
                              key={n}
                              className={n <= f.rating ? 'text-amber-500' : 'text-line'}
                              aria-hidden="true"
                            >
                              <IconStar size={15} />
                            </span>
                          ))}
                        </span>
                      </div>
                      {f.comments && (
                        <p className="text-[13px] text-ink-body leading-relaxed mt-2.5">
                          “{f.comments}”
                        </p>
                      )}
                      <p className="text-[11.5px] text-ink-faint mt-2">
                        Submitted {new Date(f.submittedAt).toLocaleDateString(undefined, {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
