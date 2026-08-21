// Page frame shared by Login and Register: illustrated backdrop, branded top
// bar, centred card slot, footer. `nav` is the top-right cross-link, which is
// the only part that differs between the two screens.
import React from 'react';
import { Link } from 'react-router-dom';
import { IconShieldMark } from '../icons';
import { AuthBackdrop } from './AuthScene';

export default function AuthShell({ nav, children }) {
  return (
    <>
      <AuthBackdrop />

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="flex items-center justify-between gap-4 px-5 py-6 sm:px-9">
          <Link to="/" className="flex items-center gap-2.5">
            <IconShieldMark size={30} />
            <span className="font-display text-[19px] font-bold tracking-[-0.3px] text-ink">
              SmartCivicConnect
            </span>
          </Link>
          <div className="text-[13.5px] text-ink-muted">{nav}</div>
        </header>

        <main className="flex flex-1 items-center justify-center px-4 pb-8 sm:px-6">
          {children}
        </main>

        <footer className="px-5 pb-7 text-center text-[12.5px] text-ink-faint">
          © {new Date().getFullYear()} SmartCivicConnect. All rights reserved.
        </footer>
      </div>
    </>
  );
}

// The white card both screens sit in. Pages supply the two columns.
export function AuthCard({ className = '', children }) {
  return (
    <div
      className={`w-full rounded-[26px] border border-[#e7ece9] bg-white p-4 shadow-[0_30px_60px_-24px_rgba(16,42,30,0.22)] animate-card-appear sm:p-5 ${className}`}
    >
      {children}
    </div>
  );
}

// Top-right cross-link, e.g. "New here? Register here".
export function NavLink({ prompt, to, label }) {
  return (
    <>
      <span className="hidden sm:inline">{prompt} </span>
      <Link to={to} className="font-semibold text-[#0f7f43] transition-fast hover:text-[#0b5f32] hover:underline">
        {label}
      </Link>
    </>
  );
}
