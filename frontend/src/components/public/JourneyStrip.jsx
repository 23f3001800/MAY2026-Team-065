// What happens to a report after you file it.
//
// This is the product's actual subject: not placing a pin, but the chain of
// custody that follows. So the hero visual is a record advancing through that
// chain rather than a decorative map — a map says "we know where", which is the
// easy part and the part every civic app already shows.
//
// The stages are the real lifecycle, in the real order, with the real actor at
// each step. Nothing here is invented: a complaint genuinely moves
// Reported -> Classified -> Reviewed -> Assigned -> Resolved, and the reference
// format matches what the backend issues (CMP-XXXXXX).
//
// Motion is on a timer rather than scroll, because the point is to show a
// sequence, and a reader who does not scroll should still see it happen.
// Honours prefers-reduced-motion by rendering the finished state.
import React, { useEffect, useState } from 'react';
import {
  IconSend, IconSparkles, IconEye, IconUsers, IconCheckCircle,
} from '../dashboard/icons';

const STAGES = [
  {
    key: 'reported',
    label: 'Reported',
    actor: 'Citizen',
    icon: IconSend,
    detail: 'Photo, location and description captured in under a minute.',
  },
  {
    key: 'classified',
    label: 'Classified',
    actor: 'Automatic',
    icon: IconSparkles,
    detail: 'Category and severity suggested, duplicates flagged.',
  },
  {
    key: 'reviewed',
    label: 'Reviewed',
    actor: 'Officer',
    icon: IconEye,
    detail: 'A person confirms the category before anyone is dispatched.',
  },
  {
    key: 'assigned',
    label: 'Assigned',
    actor: 'Field worker',
    icon: IconUsers,
    detail: 'Routed to a crew whose skills match the department.',
  },
  {
    key: 'resolved',
    label: 'Resolved',
    actor: 'Verified',
    icon: IconCheckCircle,
    detail: 'Closed with photographic evidence you can check yourself.',
  },
];

const STEP_MS = 1600;

export default function JourneyStrip({ className = '' }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setActive(STAGES.length - 1);
      return undefined;
    }
    const id = setInterval(
      () => setActive((i) => (i + 1) % (STAGES.length + 1)),
      STEP_MS,
    );
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className={`relative bg-surface rounded-2xl border border-line shadow-lg overflow-hidden ${className}`}
      aria-label="How a report moves through the service"
    >
      {/* Record header — the stamp on a municipal file. */}
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-line bg-surface-inset">
        <div className="min-w-0">
          <div className="font-mono text-[11px] text-ink-faint tracking-wide">CMP-4B7E20</div>
          <div className="text-[13.5px] font-semibold text-ink truncate mt-0.5">
            Streetlight out on Kasturba Road
          </div>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-teal-50 text-teal-700 text-[11px] font-semibold ring-1 ring-inset ring-teal-600/20">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse-dot" />
          Live
        </span>
      </div>

      <ol className="p-5 space-y-0">
        {STAGES.map((stage, i) => {
          const done = i < active;
          const current = i === active;
          const reached = done || current;
          const Icon = stage.icon;

          return (
            <li key={stage.key} className="relative flex gap-3.5 pb-5 last:pb-0">
              {/* Connector. Fills as the record advances, so the line itself
                  carries the progress rather than only the dots. */}
              {i < STAGES.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute left-[15px] top-9 bottom-0 w-px bg-line overflow-hidden"
                >
                  <span
                    className={`block w-full bg-teal-500 origin-top transition-transform duration-700 ease-out ${
                      done ? 'scale-y-100' : 'scale-y-0'
                    }`}
                    style={{ height: '100%' }}
                  />
                </span>
              )}

              <span
                className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors duration-500 ${
                  done
                    ? 'bg-teal-500 border-teal-500 text-white'
                    : current
                      ? 'bg-surface border-civic-600 text-civic-700'
                      : 'bg-surface border-line text-ink-faint'
                }`}
              >
                <Icon size={15} />
                {current && (
                  <span className="absolute inset-0 rounded-full ring-4 ring-civic-500/15 animate-pulse-dot" />
                )}
              </span>

              <div
                className={`min-w-0 flex-1 transition-opacity duration-500 ${
                  reached ? 'opacity-100' : 'opacity-45'
                }`}
              >
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-[13.5px] font-semibold text-ink">{stage.label}</span>
                  <span className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                    {stage.actor}
                  </span>
                </div>
                <p className="text-[12.5px] text-ink-muted leading-snug mt-0.5">{stage.detail}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
