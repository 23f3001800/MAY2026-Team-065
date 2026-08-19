// How sure the classifier was about a complaint's category.
//
// The officer queue can order by this, and an ordering whose key is invisible
// looks arbitrary: a list sorted "least confident first" is indistinguishable
// from a list in no order at all unless the number is on screen.
//
// Shown as a percentage with a small meter, because the useful comparison is
// between rows rather than the absolute value. Three bands, and the boundaries
// are the same ones the "needs a second look" filter uses, so a complaint that
// reads amber here is exactly one the filter would surface.
//
// A complaint that was never classified has NO confidence -- not zero. It is
// rendered as an explicit dash, because a 0% would say the model looked and was
// certain it had no idea, which is a different and much stronger claim.
import React from 'react';
import { IconSparkles } from './icons';

// Under this, an officer should re-read the classification before trusting it.
export const DOUBTFUL_BELOW = 0.6;
const CONFIDENT_AT_OR_ABOVE = 0.8;

export default function ConfidenceBadge({ value, showMeter = true, className = '' }) {
  const known = typeof value === 'number' && Number.isFinite(value);

  if (!known) {
    return (
      <span
        title="This complaint was never classified — triage was off, or it predates it."
        className={`inline-flex items-center gap-1 text-[11px] text-ink-faint ${className}`}
      >
        <IconSparkles size={11} className="opacity-40" />
        not classified
      </span>
    );
  }

  const pct = Math.round(value * 100);
  const band = value >= CONFIDENT_AT_OR_ABOVE
    ? { text: 'text-teal-700', bar: 'bg-teal-500', label: 'confident' }
    : value >= DOUBTFUL_BELOW
      ? { text: 'text-civic-700', bar: 'bg-civic-500', label: 'fair' }
      : { text: 'text-caution-700', bar: 'bg-caution-500', label: 'needs a look' };

  return (
    <span
      title={`The classifier was ${pct}% confident in this category (${band.label}).`}
      className={`inline-flex items-center gap-1.5 ${className}`}
    >
      <span className={`text-[12px] font-semibold tnum ${band.text}`}>{pct}%</span>
      {showMeter && (
        <span className="w-9 h-1.5 rounded-full bg-surface-inset overflow-hidden shrink-0">
          <span
            className={`block h-full rounded-full ${band.bar}`}
            style={{ width: `${Math.max(pct, 4)}%` }}
          />
        </span>
      )}
    </span>
  );
}
