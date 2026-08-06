// Inline confirmation / error banner.
//
// Deliberately inline (in the page flow, above the content it refers to) rather
// than floating in a corner. These messages are about the thing the user just
// acted on — "CMP-123 assigned to Ravi" — and a corner toast makes you look
// away from that thing to read about it. Floating toasts also get missed
// entirely on a phone held one-handed.
//
// role is chosen by tone: errors announce assertively because the user's action
// did not happen; successes are polite so they do not interrupt a screen reader
// mid-sentence.
import React, { useEffect } from 'react';
import { IconCheckCircle, IconAlertTriangle, IconX } from './icons';

const TONES = {
  success: {
    wrap: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    icon: IconCheckCircle,
    iconColor: 'text-emerald-600',
  },
  error: {
    wrap: 'bg-red-50 border-red-200 text-red-900',
    icon: IconAlertTriangle,
    iconColor: 'text-red-600',
  },
  warning: {
    wrap: 'bg-amber-50 border-amber-200 text-amber-900',
    icon: IconAlertTriangle,
    iconColor: 'text-amber-600',
  },
};

/**
 * @param {string} message   text to show; falsy renders nothing
 * @param {'success'|'error'|'warning'} tone
 * @param {Function} [onDismiss]  shows a close button and enables auto-dismiss
 * @param {number} [autoHideMs]   0 disables. Errors should not auto-hide.
 */
export default function Toast({ message, tone = 'success', onDismiss, autoHideMs = 4000 }) {
  const { wrap, icon: Icon, iconColor } = TONES[tone] || TONES.success;

  useEffect(() => {
    if (!message || !onDismiss || !autoHideMs) return undefined;
    const t = setTimeout(onDismiss, autoHideMs);
    return () => clearTimeout(t);
  }, [message, onDismiss, autoHideMs]);

  if (!message) return null;

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      className={`animate-toast-in flex items-start gap-2.5 border text-[13px] font-medium px-4 py-3 rounded-xl shadow-sm ${wrap}`}
    >
      <Icon size={16} className={`shrink-0 mt-px ${iconColor}`} />
      <span className="flex-1 leading-snug">{message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="focus-ring shrink-0 -mr-1 -mt-0.5 w-6 h-6 rounded-md flex items-center justify-center opacity-60 hover:opacity-100 hover:bg-black/5 transition"
        >
          <IconX size={14} />
        </button>
      )}
    </div>
  );
}
