// Public landing page at "/". A signed-in visitor goes straight to their
// role's dashboard; everyone else gets this.
//
// The page is built to read like a well-made public notice rather than a
// startup splash: a drawn city as the ground, civic green, strong left-aligned
// type, and only three things said — what the service is, what it promises,
// and how long it takes to use.
//
// NO INVENTED FIGURES. The brief asked for a statistics band -- total
// complaints, resolution rate, average time. Those cannot be had here:
// /analytics/* is officer- and admin-only, and this page only renders for
// signed-out visitors. Rather than print numbers nobody can verify, the page
// states the things that ARE facts: the response targets the service actually
// commits to (SLA_*_HOURS in the backend environment), and the lifecycle a
// report genuinely moves through. A citizen cares more about "what will you
// do, and by when" than a total anyway.
import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { CivicWordmark } from '../components/public/CivicMark';
import HeroScene, { LeafSprig } from '../components/public/HeroScene';
import JourneyStrip from '../components/public/JourneyStrip';
import {
  IconTrack, IconReport, IconCheckCircle, IconClock, IconMapPin,
} from '../components/dashboard/icons';
import { IconMail, IconPhone } from '../components/icons';
import { getCurrentUser, homePathForRole } from '../api/auth';

// The real targets from the backend's SLA configuration. These are commitments
// the service measures itself against, not marketing numbers.
const TARGETS = [
  { level: 'Critical', within: '4 hours', note: 'Anything unsafe: live wiring, a collapsed surface, flooding.' },
  { level: 'High', within: '24 hours', note: 'Blocking a road or footpath, or affecting a whole street.' },
  { level: 'Medium', within: '3 days', note: 'Disruptive but contained.' },
  { level: 'Low', within: '7 days', note: 'Cosmetic or minor damage.' },
];

const TARGET_TONE = {
  Critical: 'text-rose-700 bg-rose-50 ring-rose-600/20',
  High: 'text-amber-700 bg-amber-50 ring-amber-600/25',
  Medium: 'text-sky-700 bg-sky-50 ring-sky-600/20',
  Low: 'text-leaf-700 bg-leaf-50 ring-leaf-600/25',
};

const FOOTER_LINKS = [
  { to: '/privacy', label: 'Privacy policy' },
  { to: '/terms', label: 'Terms of use' },
  { to: '/accessibility', label: 'Accessibility' },
  { to: '/login', label: 'Track a complaint' },
];

function SectionLabel({ children }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="h-px w-8 bg-leaf-600" aria-hidden="true" />
      <span className="text-[11.5px] font-bold uppercase tracking-[0.16em] text-leaf-700">
        {children}
      </span>
    </div>
  );
}

export default function Home() {
  const user = getCurrentUser();
  if (user) return <Navigate to={homePathForRole(user.role)} replace />;

  return (
    <div className="min-h-screen bg-surface text-ink">
      {/* ── Navigation ───────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-surface border-b border-line">
        <nav className="max-w-[1140px] mx-auto px-5 sm:px-8 h-[64px] flex items-center justify-between gap-4">
          <CivicWordmark size={30} />
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="focus-ring text-[14px] font-semibold text-ink-body hover:text-ink px-3.5 py-2 rounded-lg transition-colors"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="focus-ring lift inline-flex items-center gap-2 bg-leaf-600 hover:bg-leaf-700 text-white font-semibold text-[14px] px-4 py-2.5 rounded-xl shadow-sm transition-all"
            >
              Create an account
            </Link>
          </div>
        </nav>
      </header>

      <main>
        {/* ── Hero ───────────────────────────────────────────────── */}
        <section className="relative isolate">
          <HeroScene className="absolute inset-0 -z-10" />

          <div className="max-w-[1140px] mx-auto px-5 sm:px-8 pt-12 pb-16 lg:pt-16 lg:pb-24">
            <div className="grid lg:grid-cols-[1.02fr_0.98fr] gap-12 lg:gap-14 items-center">
              <div className="animate-rise-in">
                <SectionLabel>Municipal grievance service</SectionLabel>

                <h1 className="font-display text-[38px] sm:text-[50px] font-extrabold leading-[1.05] tracking-[-0.025em] text-ink">
                  Report a problem.
                  <br />
                  <span className="text-leaf-600">Improve your city.</span>
                </h1>

                <p className="text-[16px] text-ink-body leading-relaxed mt-5 max-w-[46ch]">
                  Tell the council what is broken on your street. Every report gets a reference
                  number, a named department and a date it is due by — and you can watch it move
                  until the work is done.
                </p>

                <div className="flex items-center gap-3 mt-8 flex-wrap">
                  <Link
                    to="/register"
                    className="focus-ring lift inline-flex items-center gap-2 bg-leaf-600 hover:bg-leaf-700 text-white font-display font-bold text-[15px] px-6 py-3.5 rounded-xl shadow-md transition-all"
                  >
                    <IconReport size={17} /> Report a complaint
                  </Link>
                  <Link
                    to="/login"
                    className="focus-ring inline-flex items-center gap-2 bg-surface border border-line hover:border-leaf-400 text-ink-body font-semibold text-[15px] px-6 py-3.5 rounded-xl shadow-sm transition-all"
                  >
                    <IconTrack size={17} /> Track a complaint
                  </Link>
                </div>

                <p className="flex items-center gap-2 text-[12.5px] text-ink-muted mt-5">
                  <IconCheckCircle size={14} className="text-leaf-600 shrink-0" />
                  Free to use. Your report is handled by the department responsible for it.
                </p>
              </div>

              {/* The record, moving. This is the product. */}
              <div className="animate-rise-in" style={{ animationDelay: '120ms' }}>
                <JourneyStrip />
              </div>
            </div>
          </div>
        </section>

        {/* ── Response commitments ───────────────────────────────── */}
        <section className="border-y border-line bg-surface">
          <div className="max-w-[1140px] mx-auto px-5 sm:px-8 py-14 lg:py-16">
            <div className="grid lg:grid-cols-[0.85fr_1.15fr] gap-10 lg:gap-16">
              <div>
                <SectionLabel>What you can expect</SectionLabel>
                <h2 className="font-display text-[28px] sm:text-[32px] font-bold leading-tight tracking-[-0.02em] text-ink max-w-[18ch]">
                  Every report gets a deadline, not a queue position
                </h2>
                <p className="text-[15px] text-ink-body leading-relaxed mt-4 max-w-[46ch]">
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
                    className="animate-rise-in stagger bg-surface rounded-xl border border-line p-4"
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

        {/* ── Closing ────────────────────────────────────────────── */}
        <section className="relative isolate overflow-hidden bg-leaf-50/70 border-b border-line">
          <LeafSprig
            className="pointer-events-none absolute -left-8 -top-6 w-[190px] h-[150px] opacity-55 -z-10"
            tone="#c7e5d1"
          />
          <LeafSprig
            className="pointer-events-none absolute -right-8 bottom-0 w-[190px] h-[150px] opacity-55 -z-10"
            tone="#c7e5d1"
            flip
          />

          <div className="max-w-[1140px] mx-auto px-5 sm:px-8 py-12 text-center">
            <div className="flex items-center justify-center gap-3">
              <span className="w-10 h-10 rounded-full bg-surface ring-2 ring-leaf-200 text-leaf-600 flex items-center justify-center shrink-0">
                <IconReport size={18} />
              </span>
              <h2 className="font-display text-[26px] sm:text-[29px] font-bold tracking-[-0.02em] text-ink">
                It takes about a minute
              </h2>
            </div>
            <p className="text-[14.5px] text-ink-body mt-3 max-w-[58ch] mx-auto leading-relaxed">
              A photo, a location and a sentence. The service does the rest, and tells you when
              it is done.
            </p>
            <Link
              to="/register"
              className="focus-ring lift inline-flex items-center gap-2 bg-leaf-600 hover:bg-leaf-700 text-white font-display font-bold text-[14.5px] px-5 py-3 rounded-xl shadow-md transition-all mt-5"
            >
              <IconReport size={16} /> Report a complaint
            </Link>
          </div>
        </section>
      </main>

      {/* Footer. Contact routes are stated plainly, including when nobody is
          reading -- a channel that looks open at 2am and is not is worse than
          one that says so. */}
      <footer className="bg-surface">
        <div className="max-w-[1140px] mx-auto px-5 sm:px-8 py-10">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.25fr_1.1fr_0.85fr]">
            <div>
              <CivicWordmark size={30} />
              <p className="text-[12.5px] text-ink-muted leading-relaxed mt-3.5 max-w-[34ch]">
                The municipal grievance redressal service. Report a problem in your area and
                follow it through to the work being done.
              </p>
            </div>

            <div>
              <h3 className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-ink-faint">
                Write to us
              </h3>
              <ul className="mt-3.5 space-y-2">
                <li>
                  <a
                    href="mailto:support@smartcivicconnect.gov.in"
                    className="focus-ring rounded inline-flex items-center gap-2 text-[13.5px] text-ink-body hover:text-leaf-700 transition-colors"
                  >
                    <span className="text-ink-faint shrink-0"><IconMail size={14} /></span>
                    support@smartcivicconnect.gov.in
                  </a>
                </li>
                <li>
                  <a
                    href="tel:18000000000"
                    className="focus-ring rounded inline-flex items-center gap-2 text-[13.5px] text-ink-body hover:text-leaf-700 transition-colors"
                  >
                    <span className="text-ink-faint shrink-0"><IconPhone size={14} /></span>
                    1800 000 0000
                  </a>
                </li>
                <li className="flex items-start gap-2 text-[13px] text-ink-body">
                  <IconMapPin size={14} className="text-ink-faint shrink-0 mt-[3px]" />
                  <span>
                    Municipal Grievance Redressal Department,
                    <br />
                    Office of the Commissioner
                  </span>
                </li>
              </ul>
              <p className="text-[12px] text-ink-muted leading-relaxed mt-3.5 max-w-[42ch]">
                Monday to Saturday, 9am to 6pm. For anything dangerous or urgent outside those
                hours, call the emergency services rather than filing a report.
              </p>
            </div>

            <div>
              <h3 className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-ink-faint">
                Service
              </h3>
              <ul className="mt-3.5 space-y-2 text-[13.5px]">
                {FOOTER_LINKS.map((l) => (
                  <li key={l.to}>
                    <Link
                      to={l.to}
                      className="focus-ring rounded text-ink-body hover:text-leaf-700 transition-colors"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 flex-wrap mt-8 pt-4 border-t border-line">
            <p className="text-[12.5px] text-ink-faint">
              &copy; {new Date().getFullYear()} Municipal Grievance Redressal Department.
            </p>
            <p className="text-[12.5px] text-ink-faint">
              Reports are handled by the department responsible for them.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
