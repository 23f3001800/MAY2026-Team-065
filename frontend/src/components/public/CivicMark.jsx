// The CivicConnect mark.
//
// A municipal seal reduced to its structure: a rounded square holding a stack
// of three bars, widest at the base. It reads as a stamp on a public notice and
// as a signal strength meter — a report being received. It is drawn rather than
// imported so it inherits currentColor and stays crisp at any size.
//
// Deliberately not a map pin. Every civic app uses a map pin, and this product
// is about what happens to a report AFTER it is placed, not the placing.
import React from 'react';

export default function CivicMark({ size = 36, className = '' }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-[10px] bg-civic-800 text-white shrink-0 ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        width={size * 0.55}
        height={size * 0.55}
        viewBox="0 0 20 20"
        fill="none"
        role="presentation"
      >
        {/* Three bars, ascending. The top one is teal: the report that has just
            been acknowledged. */}
        <rect x="3" y="12.5" width="14" height="3" rx="1.5" fill="currentColor" opacity="0.55" />
        <rect x="5" y="8" width="10" height="3" rx="1.5" fill="currentColor" opacity="0.8" />
        <rect x="7" y="3.5" width="6" height="3" rx="1.5" fill="#3ecfae" />
      </svg>
    </span>
  );
}

/** Mark plus wordmark, for navigation bars and the auth panel. */
export function CivicWordmark({ size = 36, className = '', tone = 'dark' }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <CivicMark size={size} />
      <span className="leading-none">
        <span
          className={`block font-display font-extrabold tracking-[-0.02em] ${
            tone === 'light' ? 'text-white' : 'text-ink'
          }`}
          style={{ fontSize: size * 0.5 }}
        >
          CivicConnect
        </span>
        <span
          className={`block font-medium tracking-[0.14em] uppercase mt-0.5 ${
            tone === 'light' ? 'text-white/55' : 'text-ink-faint'
          }`}
          style={{ fontSize: size * 0.22 }}
        >
          Municipal Grievance Service
        </span>
      </span>
    </span>
  );
}
