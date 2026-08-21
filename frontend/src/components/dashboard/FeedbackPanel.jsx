// What the resident thought of the work.
//
// This was being collected and then never shown to anyone. A rating that only
// reaches a database is an opinion poll; a rating the crew who did the job can
// read is feedback. It is also the only judgement of the work that comes from
// outside the organisation, which makes it the one number here that cannot be
// self-graded.
//
// Same component for every role, because the content is the same fact. What
// differs is the framing: a worker is looking at their own work, an officer at
// their department's, a citizen at what they themselves said.
import React from 'react';
import { IconStar, IconMessage } from './icons';

function Stars({ rating, size = 15 }) {
  const value = Math.max(0, Math.min(5, Number(rating) || 0));
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={n <= value ? 'text-amber-500' : 'text-line'}
          aria-hidden="true"
        >
          <IconStar size={size} />
        </span>
      ))}
    </span>
  );
}

function formatDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * @param {Array}  items    from getComplaintFeedback
 * @param {string} audience 'citizen' | 'officer' | 'worker'
 * @param {boolean} [compact] drop the heading, for a drawer
 */
export default function FeedbackPanel({ items = [], audience = 'citizen', compact = false }) {
  if (!items.length) {
    // Absence is worth stating for the people waiting on it, and worth staying
    // quiet about for the person who would have to write it.
    if (audience === 'citizen') return null;
    return (
      <div className={compact ? 'mt-3' : 'bg-surface rounded-xl border border-line shadow-sm p-4'}>
        <p className="text-[12.5px] text-ink-muted">
          The resident has not rated this work yet.
        </p>
      </div>
    );
  }

  const lead = {
    citizen: 'Your rating',
    officer: 'What the resident said',
    worker: 'How your work was rated',
  }[audience];

  const body = (
    <ul className="space-y-3">
      {items.map((f) => (
        <li key={f.id} className="rounded-xl bg-amber-50/60 border border-amber-100 p-3.5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Stars rating={f.rating} />
            <span className="text-[11.5px] text-ink-faint tnum">
              {formatDate(f.submittedAt)}
            </span>
          </div>
          {f.comments ? (
            <p className="flex gap-2 text-[13px] text-ink-body leading-relaxed mt-2.5">
              <IconMessage size={13} className="text-amber-600 shrink-0 mt-0.5" />
              <span>{f.comments}</span>
            </p>
          ) : (
            <p className="text-[12.5px] text-ink-faint mt-2">
              Rated without a written comment.
            </p>
          )}
        </li>
      ))}
    </ul>
  );

  if (compact) {
    return (
      <div className="mt-3">
        <h4 className="text-[11px] font-bold uppercase tracking-wide text-ink-muted mb-2">
          {lead}
        </h4>
        {body}
      </div>
    );
  }

  return (
    <section className="bg-surface rounded-xl border border-line shadow-sm p-5">
      <h3 className="font-display text-[15px] font-bold text-ink mb-3">{lead}</h3>
      {body}
    </section>
  );
}
