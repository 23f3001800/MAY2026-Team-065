// Public landing page at "/". A signed-in visitor goes straight to their
// role's dashboard; everyone else gets this.
//
// Deliberately not the dark-glass-and-blobs look the app used to wear. That
// aesthetic says "startup", and the thing being asked of a visitor here is to
// trust a municipal service with a report about their street. So the page is
// built to read like a well-made public notice: warm paper ground, civic navy,
// strong left-aligned type, rules and stamps rather than glow.
//
// NO INVENTED FIGURES. The brief asked for a statistics band -- total
// complaints, resolution rate, average time. Those cannot be had here:
// /analytics/* is officer- and admin-only, and this page only renders for
// signed-out visitors. Rather than print numbers nobody can verify, the page
// states the things that ARE facts: the departments that exist, and the
// response targets the service actually commits to (SLA_*_HOURS in the backend
// environment). A citizen cares more about "what will you do, and by when"
// than a total anyway.
import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { CivicWordmark } from '../components/public/CivicMark';
import JourneyStrip from '../components/public/JourneyStrip';
import {
  IconArrowRight, IconTrack, IconReport, IconCheckCircle, IconClock,
  IconDroplet, IconTrash, IconMapPin, IconBulb, IconBuilding,
} from '../components/dashboard/icons';
import { getCurrentUser, homePathForRole } from '../api/auth';

// The five departments the service actually runs, matching the seeded category
// table. Listing them sets an honest expectation about what can be reported.
const SERVICES = [
  { icon: IconMapPin, name: 'Roads & Transport', example: 'Potholes, damaged carriageway, blocked footpaths' },
  { icon: IconDroplet, name: 'Water & Plumbing', example: 'Burst mains, leaks, drainage backing up' },
  { icon: IconTrash, name: 'Sanitation', example: 'Missed collections, fly-tipping, overflowing bins' },
  { icon: IconBulb, name: 'Electrical', example: 'Streetlights out, exposed wiring, failed signals' },
  { icon: IconBuilding, name: 'Public Works', example: 'Damage to parks, benches and public property' },
];

// The real targets from the backend's SLA configuration. These are commitments
// the service measures itself against, not marketing numbers.
const TARGETS = [
  { level: 'Critical', within: '4 hours', note: 'Anything unsafe: live wiring, a collapsed surface, flooding.' },
  { level: 'High', within: '24 hours', note: 'Blocking a road or footpath, or affecting a whole street.' },
  { level: 'Medium', within: '3 days', note: 'Disruptive but contained.' },
  { level: 'Low', within: '7 days', note: 'Cosmetic or minor damage.' },
];

const TARGET_TONE = {
  Critical: 'text-danger-700 bg-danger-50 ring-danger-600/20',
  High: 'text-caution-700 bg-caution-50 ring-caution-600/20',
  Medium: 'text-civic-700 bg-civic-50 ring-civic-600/20',
  Low: 'text-teal-700 bg-teal-50 ring-teal-600/20',
};

function SectionLabel({ children }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="h-px w-8 bg-civic-600" aria-hidden="true" />
      <span className="text-[11.5px] font-bold uppercase tracking-[0.16em] text-civic-700">
        {children}
      </span>
    </div>
  );
}

export default function Home() {
  const user = getCurrentUser();
  if (user) return <Navigate to={homePathForRole(user.role)} replace />;

  return (
    <div className="min-h-screen bg-surface-sunken text-ink">
      {/* ── Navigation ───────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-surface-sunken/85 backdrop-blur border-b border-line">
        <nav className="max-w-[1140px] mx-auto px-5 sm:px-8 h-[72px] flex items-center justify-between gap-4">
          <CivicWordmark size={34} />
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="focus-ring text-[14px] font-semibold text-ink-body hover:text-ink px-3.5 py-2 rounded-lg transition-colors"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="focus-ring lift inline-flex items-center gap-2 bg-civic-800 hover:bg-civic-900 text-white font-semibold text-[14px] px-4 py-2.5 rounded-xl shadow-sm transition-all"
            >
              Create an account
            </Link>
          </div>
        </nav>
      </header>

      <main>
        {/* ── Hero ───────────────────────────────────────────────── */}
        <section className="max-w-[1140px] mx-auto px-5 sm:px-8 pt-14 pb-16 lg:pt-20 lg:pb-24">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-16 items-center">
            <div className="animate-rise-in">
              <SectionLabel>Municipal grievance service</SectionLabel>

              <h1 className="font-display text-[38px] sm:text-[50px] font-extrabold leading-[1.05] tracking-[-0.025em] text-ink">
                Report a problem.
                <br />
                <span className="text-civic-700">Improve your city.</span>
              </h1>

              <p className="text-[16.5px] text-ink-body leading-relaxed mt-5 max-w-[52ch]">
                Tell the council what is broken on your street. Every report gets a reference
                number, a named department and a date it is due by — and you can watch it move
                until the work is done.
              </p>

              <div className="flex items-center gap-3 mt-8 flex-wrap">
                <Link
                  to="/register"
                  className="focus-ring lift inline-flex items-center gap-2 bg-civic-800 hover:bg-civic-900 text-white font-display font-bold text-[15px] px-6 py-3.5 rounded-xl shadow-md transition-all"
                >
                  <IconReport size={17} /> Report a complaint
                </Link>
                <Link
                  to="/login"
                  className="focus-ring inline-flex items-center gap-2 bg-surface border border-line hover:border-civic-400 text-ink-body font-semibold text-[15px] px-6 py-3.5 rounded-xl shadow-sm transition-all"
                >
                  <IconTrack size={17} /> Track a complaint
                </Link>
              </div>

              <p className="flex items-center gap-2 text-[12.5px] text-ink-muted mt-5">
                <IconCheckCircle size={14} className="text-teal-600 shrink-0" />
                Free to use. Your report is handled by the department responsible for it.
              </p>
            </div>

            {/* The record, moving. This is the product. */}
            <div className="animate-rise-in" style={{ animationDelay: '120ms' }}>
              <JourneyStrip />
            </div>
          </div>
        </section>

        {/* ── Response commitments ───────────────────────────────── */}
        <section className="border-y border-line bg-surface">
          <div className="max-w-[1140px] mx-auto px-5 sm:px-8 py-14 lg:py-16">
            <div className="grid lg:grid-cols-[0.85fr_1.15fr] gap-10 lg:gap-16">
              <div>
                <SectionLabel>What you can expect</SectionLabel>
                <h2 className="font-display text-[28px] sm:text-[32px] font-bold leading-tight tracking-[-0.02em] text-ink">
                  Every report gets a deadline, not a queue position
                </h2>
                <p className="text-[15px] text-ink-body leading-relaxed mt-4">
                  How urgent a problem is decides how long the service has to fix it. The clock
                  starts the moment you submit, it is visible on your complaint, and an officer
                  sees it turn red before you have to chase.
                </p>
              </div>

              <ul className="grid sm:grid-cols-2 gap-3">
                {TARGETS.map((t, i) => (
                  <li
                    key={t.level}
                    style={{ '--i': i }}
                    className="animate-rise-in stagger bg-surface-inset rounded-xl border border-line p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wide ring-1 ring-inset ${TARGET_TONE[t.level]}`}
                      >
                        {t.level}
                      </span>
                      <span className="inline-flex items-center gap-1.5 font-display text-[17px] font-bold text-ink tnum">
                        <IconClock size={14} className="text-ink-faint" />
                        {t.within}
                      </span>
                    </div>
                    <p className="text-[12.5px] text-ink-muted leading-snug mt-2.5">{t.note}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── What you can report ────────────────────────────────── */}
        <section className="max-w-[1140px] mx-auto px-5 sm:px-8 py-14 lg:py-20">
          <SectionLabel>Departments</SectionLabel>
          <h2 className="font-display text-[28px] sm:text-[32px] font-bold leading-tight tracking-[-0.02em] text-ink max-w-[20ch]">
            Five services, one place to reach them
          </h2>
          <p className="text-[15px] text-ink-body leading-relaxed mt-4 max-w-[62ch]">
            You do not have to know which department owns the problem. Describe it, and the
            report is routed to the team whose remit it falls under.
          </p>

          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
            {SERVICES.map((s, i) => (
              <li
                key={s.name}
                style={{ '--i': i }}
                className="animate-rise-in stagger group bg-surface rounded-2xl border border-line shadow-sm p-5 hover:shadow-md hover:border-civic-300 transition-all"
              >
                <span className="w-11 h-11 rounded-xl bg-civic-50 text-civic-700 flex items-center justify-center">
                  <s.icon size={20} />
                </span>
                <h3 className="font-display font-bold text-[16px] text-ink mt-4">{s.name}</h3>
                <p className="text-[13px] text-ink-muted leading-relaxed mt-1.5">{s.example}</p>
              </li>
            ))}

            {/* The fifth cell carries the call to action rather than sitting
                empty on a three-column grid. */}
            <li
              style={{ '--i': SERVICES.length }}
              className="animate-rise-in stagger bg-civic-800 rounded-2xl p-5 flex flex-col justify-between text-white"
            >
              <div>
                <h3 className="font-display font-bold text-[16px]">Something else?</h3>
                <p className="text-[13px] text-white/70 leading-relaxed mt-1.5">
                  File it anyway. An officer reads every report and routes anything that does
                  not fit neatly.
                </p>
              </div>
              <Link
                to="/register"
                className="focus-ring inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-white mt-5 group"
              >
                Get started
                <IconArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          </ul>
        </section>

        {/* ── Closing ────────────────────────────────────────────── */}
        <section className="border-t border-line bg-surface">
          <div className="max-w-[1140px] mx-auto px-5 sm:px-8 py-14 lg:py-16 text-center">
            <h2 className="font-display text-[26px] sm:text-[30px] font-bold tracking-[-0.02em] text-ink">
              It takes about a minute
            </h2>
            <p className="text-[15px] text-ink-body mt-3 max-w-[54ch] mx-auto leading-relaxed">
              A photo, a location and a sentence. The service does the rest, and tells you when
              it is done.
            </p>
            <Link
              to="/register"
              className="focus-ring lift inline-flex items-center gap-2 bg-civic-800 hover:bg-civic-900 text-white font-display font-bold text-[15px] px-6 py-3.5 rounded-xl shadow-md transition-all mt-7"
            >
              <IconReport size={17} /> Report a complaint
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="max-w-[1140px] mx-auto px-5 sm:px-8 py-8 flex items-center justify-between gap-4 flex-wrap">
          <CivicWordmark size={28} />
          <p className="text-[12.5px] text-ink-muted">
            A municipal grievance redressal service.
          </p>
        </div>
      </footer>
    </div>
  );
}
