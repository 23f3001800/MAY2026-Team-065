// Shared loading / error / empty panels, so every data-backed page fails the
// same way instead of each inventing its own spinner.
import React from 'react';
import { IconAlertTriangle, IconInbox } from './icons';

export function LoadingPanel({ label = 'Loading…' }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 flex flex-col items-center text-center">
      <span
        className="w-8 h-8 border-2 border-slate-200 rounded-full border-t-primary animate-spin-slow"
        role="status"
        aria-label={label}
      />
      <p className="text-[14px] text-slate-500 mt-4">{label}</p>
    </div>
  );
}

// `error` is a message string. `onRetry` renders a retry button when given.
export function ErrorPanel({ error, onRetry }) {
  return (
    <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-10 flex flex-col items-center text-center">
      <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mb-4">
        <IconAlertTriangle size={26} />
      </div>
      <h2 className="font-display font-bold text-slate-800 text-lg">Could not load this</h2>
      <p className="text-[14px] text-slate-600 mt-1.5 max-w-md">{error}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-5 inline-flex items-center gap-2 bg-primary hover:bg-emerald-600 text-white font-semibold text-[14px] px-4 py-2.5 rounded-xl shadow-btn transition-colors"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyPanel({ title, message, icon: Icon = IconInbox, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 flex flex-col items-center text-center">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-4">
        <Icon size={26} />
      </div>
      <h2 className="font-display font-bold text-slate-800 text-lg">{title}</h2>
      {message && <p className="text-[14px] text-slate-500 mt-1 max-w-sm">{message}</p>}
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}
