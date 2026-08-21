// The frame around signing in and registering.
//
// Replaces the old dark glass card floating over animated blobs. Two reasons:
// it did not match anything behind the login, so the product changed character
// the moment you authenticated; and a government service that opens with a
// neon-glass hero has spent its credibility before the first field.
//
// A split: the left panel states who this is and what it does, the right holds
// the form. On narrow screens the panel collapses to a header strip rather than
// disappearing, so the service still identifies itself.
import React from 'react';
import { Link } from 'react-router-dom';
import { CivicWordmark } from './CivicMark';
import { IconArrowLeft } from '../dashboard/icons';

/**
 * @param {string} title    the form's heading
 * @param {string} subtitle one line under it
 * @param {node}   aside    what the left panel argues, per page
 */
export default function AuthShell({ title, subtitle, aside, children }) {
  return (
    <div className="min-h-screen bg-surface-sunken flex flex-col lg:flex-row">
      {/* ── Identity panel ─────────────────────────────────────── */}
      <aside className="lg:w-[46%] xl:w-[42%] bg-civic-900 text-white flex flex-col justify-between p-6 sm:p-10 lg:p-12 relative overflow-hidden">
        {/* One quiet geometric wash. Not a blob field -- a single angled plane,
            like the fold on an official envelope. */}
        <span
          aria-hidden="true"
          className="absolute -right-24 -top-24 w-[420px] h-[420px] rounded-[80px] rotate-[24deg] bg-white/[0.035]"
        />
        <span
          aria-hidden="true"
          className="absolute -left-32 bottom-[-120px] w-[360px] h-[360px] rounded-[70px] rotate-[18deg] bg-teal-500/[0.06]"
        />

        <div className="relative z-10">
          <Link to="/" className="focus-ring inline-block rounded-lg">
            <CivicWordmark size={34} tone="light" />
          </Link>
        </div>

        <div className="relative z-10 hidden lg:block max-w-[42ch] py-10">{aside}</div>

        <div className="relative z-10">
          <Link
            to="/"
            className="focus-ring inline-flex items-center gap-1.5 text-[13px] font-medium text-white/60 hover:text-white transition-colors"
          >
            <IconArrowLeft size={14} /> Back to the public page
          </Link>
        </div>
      </aside>

      {/* ── Form ───────────────────────────────────────────────── */}
      <main className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-[420px] animate-rise-in">
          <h1 className="font-display text-[28px] font-bold tracking-[-0.02em] text-ink">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[14px] text-ink-muted mt-1.5 leading-relaxed">{subtitle}</p>
          )}
          <div className="mt-7">{children}</div>
        </div>
      </main>
    </div>
  );
}

/** A point made on the identity panel: heading plus one supporting line. */
export function AsidePoint({ children, label }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className="mt-[7px] h-1.5 w-1.5 rounded-full bg-teal-400 shrink-0"
      />
      <span>
        <span className="block text-[14.5px] font-semibold text-white">{label}</span>
        <span className="block text-[13.5px] text-white/60 leading-relaxed mt-0.5">
          {children}
        </span>
      </span>
    </li>
  );
}
