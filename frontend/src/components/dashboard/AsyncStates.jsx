// Shared loading / error / empty panels, so every data-backed page fails the
// same way instead of each inventing its own.
//
// LoadingPanel takes a `variant` matching the shape of what is loading. Prefer
// a shaped skeleton over the spinner: it holds the layout so the page does not
// jump when data lands. The spinner remains for the genuinely unknown case.
import React from 'react';
import { IconAlertTriangle, IconInbox, IconRefresh } from './icons';
import { SkeletonTable, SkeletonCards, SkeletonStats, SkeletonText } from './Skeleton';

export function LoadingPanel({ label = 'Loading…', variant = 'spinner', rows, columns, count }) {
  if (variant === 'table') return <SkeletonTable rows={rows} columns={columns} />;
  if (variant === 'cards') return <SkeletonCards count={count} />;
  if (variant === 'stats') return <SkeletonStats count={count} />;
  if (variant === 'detail') {
    return (
      <div className="bg-white rounded-2xl border border-line shadow-sm p-6 space-y-4" role="status" aria-label={label}>
        <SkeletonText lines={1} className="max-w-[40%]" />
        <SkeletonText lines={4} />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-line shadow-sm p-12 flex flex-col items-center text-center animate-rise-in">
      <span
        className="w-8 h-8 border-2 border-slate-200 rounded-full border-t-primary animate-spin-slow"
        role="status"
        aria-label={label}
      />
      <p className="text-[14px] text-ink-muted mt-4">{label}</p>
    </div>
  );
}

// `error` is a message string. `onRetry` renders a retry button when given.
export function ErrorPanel({ error, onRetry }) {
  return (
    <div
      role="alert"
      className="bg-white rounded-2xl border border-red-200 shadow-sm p-10 flex flex-col items-center text-center animate-rise-in"
    >
      <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mb-4">
        <IconAlertTriangle size={26} />
      </div>
      <h2 className="font-display font-bold text-ink text-lg">Could not load this</h2>
      <p className="text-[14px] text-ink-body mt-1.5 max-w-md leading-relaxed">{error}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="focus-ring lift mt-5 inline-flex items-center gap-2 bg-primary hover:bg-emerald-600 text-white font-semibold text-[14px] px-4 py-2.5 rounded-xl shadow-btn hover:shadow-btn-hover transition-all"
        >
          <IconRefresh size={16} /> Try again
        </button>
      )}
    </div>
  );
}

export function EmptyPanel({ title, message, icon: Icon = IconInbox, children }) {
  return (
    <div className="bg-white rounded-2xl border border-line shadow-sm p-12 flex flex-col items-center text-center animate-rise-in">
      {/* Concentric tint rather than a flat square — gives the icon somewhere
          to sit so an empty screen still feels designed. */}
      <div className="relative mb-4">
        <div className="absolute inset-0 -m-3 rounded-full bg-slate-50" aria-hidden="true" />
        <div className="relative w-14 h-14 rounded-2xl bg-slate-100 text-ink-faint flex items-center justify-center">
          <Icon size={26} />
        </div>
      </div>
      <h2 className="font-display font-bold text-ink text-lg">{title}</h2>
      {message && <p className="text-[14px] text-ink-muted mt-1.5 max-w-sm leading-relaxed">{message}</p>}
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}
