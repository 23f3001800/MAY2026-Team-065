// Where a number came from.
//
// The whole trust argument of this product rests on the reader being able to
// tell a counted fact from a machine's opinion. A dashboard that renders both
// in the same grey text is asking to be believed on faith, which is exactly
// what a civic tool cannot do.
//
// Three levels, and they are not interchangeable:
//
//   verified   Counted from records the backend returned. Reproducible.
//   derived    Aggregated in the browser from the full record set. Still real
//              data and still reproducible, but computed here rather than by a
//              server-side analytics service — so it is labelled distinctly.
//   ai         A model's interpretation. Never a number of its own.
//   insufficient  The data needed does not exist. Say so; do not estimate.
import React from 'react';

const LEVELS = {
  verified: {
    mark: '✓',
    label: 'Verified data',
    cls: 'bg-leaf-50 text-leaf-700 ring-leaf-600/25',
    title: 'Counted directly from records returned by the backend.',
  },
  derived: {
    mark: '∑',
    label: 'Derived',
    cls: 'bg-sky-50 text-sky-800 ring-sky-600/20',
    title: 'Aggregated in the browser from the complete complaint record set.',
  },
  ai: {
    mark: '✦',
    label: 'AI interpretation',
    cls: 'bg-indigo-50 text-indigo-700 ring-indigo-500/20',
    title: 'A model reading verified figures. The figures themselves are not the model\'s.',
  },
  insufficient: {
    mark: '⚠',
    label: 'Insufficient data',
    cls: 'bg-amber-50 text-amber-800 ring-amber-600/30',
    title: 'The backend does not expose what this needs. Nothing has been estimated.',
  },
};

export default function Provenance({ level = 'verified', children, className = '' }) {
  const meta = LEVELS[level] || LEVELS.verified;
  return (
    <span
      title={meta.title}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold
                  uppercase tracking-wide ring-1 ring-inset whitespace-nowrap ${meta.cls} ${className}`}
    >
      <span aria-hidden="true">{meta.mark}</span>
      {children || meta.label}
    </span>
  );
}

export { LEVELS as PROVENANCE_LEVELS };
