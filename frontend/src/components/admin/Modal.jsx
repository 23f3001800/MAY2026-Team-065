// Small centered modal for the admin forms (create officer / worker, reset
// password). The rest of the app uses a slide-over drawer for record detail
// (see ComplaintDrawer); a centered modal reads better for a short form that
// isn't tied to a specific record's context.
import React, { useEffect } from 'react';
import { IconX } from '../dashboard/icons';

export default function Modal({ title, onDismiss, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onDismiss();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDismiss]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onDismiss} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-[440px] bg-white rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto"
      >
        <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between z-10">
          <h2 className="font-display font-bold text-slate-900 text-[16px]">{title}</h2>
          <button
            onClick={onDismiss}
            aria-label="Close"
            className="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 flex items-center justify-center transition-colors"
          >
            <IconX size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
