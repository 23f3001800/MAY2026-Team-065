// When the city undertook to fix this by.
//
// The complaint history answered "what has happened", which is only half of
// what a citizen wants: knowing roughly when to expect a resolution matters
// more to them than the current state alone.
//
// The date is computed server-side from the severity SLA (services/sla.py,
// driven by SLA_*_HOURS in the backend environment -- currently 4h Critical,
// 24h High, 72h Medium, 168h Low). It is therefore a Verified figure and a
// real commitment, not a browser estimate, which is why the date itself leads
// and the countdown is secondary.
//
// Three states, and they are not interchangeable:
//
//   overdue    past the deadline and still open — the only alarming one
//   due soon   inside the last quarter of the window
//   on track   everything else
//   unknown    no deadline could be computed; renders nothing rather than
//              inventing a date
import React from 'react';
import { IconClock, IconAlertTriangle, IconCheckCircle } from './icons';

const DAY = 24;

/** "in 3 days" / "6 hours ago" — relative to the reader's own clock. */
function phrase(hours) {
  const abs = Math.abs(hours);
  const overdue = hours < 0;

  let value;
  if (abs < 1) value = `${Math.max(1, Math.round(abs * 60))} min`;
  else if (abs < DAY * 2) value = `${Math.round(abs)} hour${Math.round(abs) === 1 ? '' : 's'}`;
  else {
    const days = Math.round(abs / DAY);
    value = `${days} day${days === 1 ? '' : 's'}`;
  }
  return overdue ? `${value} overdue` : `due in ${value}`;
}

function formatDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  // Year omitted unless it differs from now -- "15 Aug 2026" reads as
  // bureaucratic when the deadline is next Tuesday.
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/**
 * @param {object} complaint  needs expectedResolutionAt / slaBreached / hoursRemaining
 * @param {boolean} [showDate] also print the target date, for detail views
 */
export default function SlaBadge({ complaint, showDate = false, className = '' }) {
  const { expectedResolutionAt, slaBreached, hoursRemaining } = complaint || {};

  // No deadline, no badge. A complaint with no severity or no created date
  // cannot be given one, and a placeholder would read as a commitment.
  if (!expectedResolutionAt) return null;

  const date = formatDate(expectedResolutionAt);
  const closed = hoursRemaining === null;

  // Once a complaint closes the backend stops reporting time remaining, so all
  // that can honestly be shown is what the target had been.
  if (closed) {
    if (!showDate || !date) return null;
    return (
      <span className={`inline-flex items-center gap-1.5 text-[12px] text-ink-faint ${className}`}>
        <IconCheckCircle size={12} /> Target was {date}
      </span>
    );
  }

  const soon = hoursRemaining >= 0 && hoursRemaining <= 24;
  const tone = slaBreached
    ? 'bg-danger-50 text-danger-700 ring-danger-600/20'
    : soon
      ? 'bg-caution-50 text-caution-700 ring-caution-600/20'
      : 'bg-teal-50 text-teal-700 ring-teal-600/20';
  const Icon = slaBreached ? IconAlertTriangle : IconClock;

  return (
    <span
      title={date ? `Target: ${date}` : undefined}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold
                  ring-1 ring-inset whitespace-nowrap ${tone} ${className}`}
    >
      <Icon size={11} />
      {/* The date leads: it is the commitment. The countdown is how far away
          that commitment is, which a reader can work out but should not have to. */}
      {date ? (
        <>
          {slaBreached ? 'Was due' : 'Expected'} {date}
          <span className="font-normal opacity-75">· {phrase(hoursRemaining)}</span>
        </>
      ) : phrase(hoursRemaining)}
    </span>
  );
}
