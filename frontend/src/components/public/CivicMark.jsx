// The SmartCivicConnect mark.
//
// A shield — the municipal seal's oldest shape — carrying a spark. The shield
// says "this is the council's, and it is accounted for"; the spark inside is
// the report arriving. Green rather than navy: the service is about a street
// being put right, and the landing page leads with the city, not the ministry.
//
// Drawn rather than imported so it inherits currentColor and stays crisp at any
// size. Deliberately not a map pin — every civic app uses a map pin, and this
// product is about what happens to a report AFTER it is placed.
import React from 'react';

export default function CivicMark({ size = 36, className = '' }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-[10px] bg-leaf-600 text-white shrink-0 ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        width={size * 0.6}
        height={size * 0.6}
        viewBox="0 0 24 24"
        fill="none"
        role="presentation"
      >
        {/* Shield */}
        <path
          d="M12 2.6 4.8 5.6v6.1c0 4.6 3 8.2 7.2 9.7 4.2-1.5 7.2-5.1 7.2-9.7V5.6L12 2.6Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        {/* The spark inside: a report landing. */}
        <path
          d="M12 7.4l1.15 2.6 2.6 1.15-2.6 1.15L12 14.9l-1.15-2.6-2.6-1.15 2.6-1.15L12 7.4Z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}

/** Mark plus wordmark, for navigation bars and the footer. */
export function CivicWordmark({ size = 36, className = '', tone = 'dark' }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <CivicMark size={size} />
      <span className="leading-none">
        <span
          className={`block font-display font-extrabold tracking-[-0.02em] ${
            tone === 'light' ? 'text-white' : 'text-ink'
          }`}
          style={{ fontSize: size * 0.47 }}
        >
          SmartCivicConnect
        </span>
        <span
          className={`block font-medium tracking-[0.14em] uppercase mt-1 ${
            tone === 'light' ? 'text-white/55' : 'text-ink-faint'
          }`}
          style={{ fontSize: size * 0.21 }}
        >
          Municipal Grievance Service
        </span>
      </span>
    </span>
  );
}
