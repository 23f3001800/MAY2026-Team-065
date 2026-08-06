// Public landing page at "/". A signed-in visitor is sent straight to their
// role's dashboard; everyone else gets the marketing page with a way in.
import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import AuthBackground from '../components/AuthBackground';
import {
  IconMapPin, IconUsers, IconClipboard, IconChart, IconArrowRight,
  IconCheckCircle, IconSend,
} from '../components/dashboard/icons';
import { getCurrentUser, homePathForRole } from '../api/auth';
import { ROLES } from '../config';

const ROLE_COPY = {
  citizen: { icon: IconMapPin, text: 'Report potholes, garbage, leaks and outages in seconds, then track them to resolution.' },
  municipal_officer: { icon: IconUsers, text: 'Triage the incoming queue, route issues to the right field worker, and keep citizens updated.' },
  field_worker: { icon: IconClipboard, text: 'See what’s assigned, work the list, and mark jobs resolved from the field.' },
  admin: { icon: IconChart, text: 'City-wide analytics, user management, and oversight across every department.' },
};

const STEPS = [
  { icon: IconSend, title: 'Report', text: 'A citizen files a complaint with a photo and location.' },
  { icon: IconUsers, title: 'Assign', text: 'An officer routes it to the field worker whose skills match.' },
  { icon: IconCheckCircle, title: 'Resolve', text: 'The worker closes it out and the citizen gets notified.' },
];

export default function Home() {
  const user = getCurrentUser();
  if (user) return <Navigate to={homePathForRole(user.role)} replace />;

  return (
    <>
      <AuthBackground />
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Nav */}
        <header className="flex items-center justify-between px-6 sm:px-10 py-6 max-w-[1200px] mx-auto w-full">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 logo-gradient rounded-xl flex items-center justify-center text-white font-extrabold text-lg font-display shadow-logo">
              C
            </div>
            <span className="font-display font-bold text-lg tracking-[-0.5px] gradient-text-title">
              SmartCivicConnect
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-[14px] font-semibold text-[#cbd5e1] hover:text-white transition-fast px-3 py-2"
            >
              Login
            </Link>
            <Link
              to="/register"
              className="submit-gradient text-white font-semibold text-[14px] px-4 py-2.5 rounded-xl shadow-btn hover:shadow-btn-hover transition-smooth"
            >
              Get Started
            </Link>
          </div>
        </header>

        {/* Hero */}
        <main className="flex-1 px-6 sm:px-10 max-w-[1200px] mx-auto w-full">
          <div className="text-center max-w-[720px] mx-auto pt-10 sm:pt-16 pb-14">
            <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-[#f8fafc] leading-tight">
              Report it. Track it. <span className="gradient-text-title bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Get it fixed.</span>
            </h1>
            <p className="text-[16px] text-[#94a3b8] mt-5 leading-relaxed">
              SmartCivicConnect connects citizens, municipal officers, field workers and city
              administrators on one platform — so civic issues get seen, assigned and resolved.
            </p>
            <div className="flex items-center justify-center gap-3 mt-8 flex-wrap">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 submit-gradient text-white font-display font-bold text-[15px] px-6 py-3.5 rounded-xl shadow-btn hover:shadow-btn-hover transition-smooth"
              >
                Report an Issue <IconArrowRight size={18} />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 bg-white/5 border border-white/10 text-[#f8fafc] font-semibold text-[15px] px-6 py-3.5 rounded-xl hover:bg-white/10 transition-fast"
              >
                Sign In
              </Link>
            </div>
          </div>

          {/* Roles */}
          <section className="pb-14">
            <h2 className="text-center text-[12px] font-semibold uppercase tracking-wider text-[#64748b] mb-6">
              Built for every role in the process
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(ROLES).map(([key, role]) => {
                const { icon: Icon, text } = ROLE_COPY[key];
                return (
                  <div
                    key={key}
                    className="bg-[rgba(15,23,42,0.4)] backdrop-blur-[10px] border border-[rgba(255,255,255,0.07)] rounded-2xl p-5 text-left"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-primary mb-3.5">
                      <Icon size={19} />
                    </div>
                    <h3 className="font-display font-bold text-[#f8fafc] text-[15px] mb-1.5">{role.label}</h3>
                    <p className="text-[13px] text-[#94a3b8] leading-relaxed">{text}</p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* How it works */}
          <section className="pb-16">
            <h2 className="text-center text-[12px] font-semibold uppercase tracking-wider text-[#64748b] mb-6">
              How it works
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {STEPS.map((s, i) => (
                <div key={s.title} className="relative bg-[rgba(15,23,42,0.4)] backdrop-blur-[10px] border border-[rgba(255,255,255,0.07)] rounded-2xl p-6 text-left">
                  <span className="text-[11px] font-bold text-primary">STEP {i + 1}</span>
                  <div className="w-10 h-10 rounded-xl logo-gradient flex items-center justify-center text-white mt-3 mb-3.5 shadow-logo">
                    <s.icon size={18} />
                  </div>
                  <h3 className="font-display font-bold text-[#f8fafc] text-[15px] mb-1.5">{s.title}</h3>
                  <p className="text-[13px] text-[#94a3b8] leading-relaxed">{s.text}</p>
                </div>
              ))}
            </div>
          </section>
        </main>

        <footer className="text-center text-[12px] text-[#64748b] py-6 border-t border-white/5">
          SmartCivicConnect — a civic complaint &amp; resolution portal.
        </footer>
      </div>
    </>
  );
}
