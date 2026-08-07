// Skeleton placeholders.
//
// These mirror the shape of the content they stand in for, which is the whole
// point: the layout is already correct when the data arrives, so nothing jumps.
// A centred spinner cannot do that — it collapses the page to one dot and then
// reflows everything.
import React from 'react';

export function Skeleton({ className = '', style }) {
  return (
    <div
      className={`skeleton animate-shimmer ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

// Paragraph of fake text. The last line is short, the way real text wraps.
export function SkeletonText({ lines = 3, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          className="h-3"
          style={{ width: i === lines - 1 ? '60%' : '100%' }}
        />
      ))}
    </div>
  );
}

// Stand-in for a KPI row.
export function SkeletonStats({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-line p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-9 w-9 rounded-xl" />
          </div>
          <Skeleton className="h-7 w-20 mt-4" />
          <Skeleton className="h-3 w-28 mt-3" />
        </div>
      ))}
    </div>
  );
}

/**
 * Stand-in for a data table. `columns` sets how many cells per row so the
 * placeholder lines up with the real header above it.
 */
export function SkeletonTable({ rows = 6, columns = 5 }) {
  // Varied widths stop the block reading as a barcode.
  const widths = ['70%', '90%', '55%', '80%', '65%', '75%'];
  return (
    <div
      className="bg-white rounded-2xl border border-line shadow-sm overflow-hidden"
      role="status"
      aria-label="Loading results"
    >
      {Array.from({ length: rows }, (_, r) => (
        <div
          key={r}
          className="flex items-center gap-4 px-5 py-4 border-b border-slate-100 last:border-0"
        >
          {Array.from({ length: columns }, (_, c) => (
            <Skeleton
              key={c}
              className="h-3 flex-1"
              style={{ maxWidth: widths[(r + c) % widths.length] }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// Stand-in for a grid of cards (nearby issues, worker tasks).
export function SkeletonCards({ count = 4, columns = 'sm:grid-cols-2' }) {
  return (
    <div className={`grid grid-cols-1 ${columns} gap-4`} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-line p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-3 w-1/2 mt-3" />
          <div className="flex items-center justify-between mt-4">
            <Skeleton className="h-5 w-20 rounded-md" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default Skeleton;
