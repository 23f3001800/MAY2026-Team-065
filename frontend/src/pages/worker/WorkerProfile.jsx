// Field worker profile: identity plus the one real self-service action a
// worker has on the backend -- toggling their own availability.
//
// Worth knowing: there is no way to read your *current* availability back.
// PATCH /workers/me/availability returns the new value after a change, but
// GET /workers/ (the only endpoint that lists availabilityStatus) is
// administrator/officer only -- a field worker gets a 403 calling it. So this
// page does not assume a starting state; it shows "not confirmed" until the
// worker actually sets one, rather than guessing "Available" and being wrong.
import React, { useState } from 'react';
import { IconMail, IconShieldCheck } from '../../components/icons';
import { IconCheckCircle } from '../../components/dashboard/icons';
import UnavailableNote from '../../components/dashboard/UnavailableNote';
import { getCurrentUser } from '../../api/auth';
import { setMyAvailability } from '../../api/workers';

function Row({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3.5 py-3.5">
      <span className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
        <Icon size={17} />
      </span>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
        <div className="text-[14px] font-medium text-slate-800 truncate">{value}</div>
      </div>
    </div>
  );
}

export default function WorkerProfile() {
  const user = getCurrentUser();
  const [status, setStatus] = useState(null); // null = not confirmed yet
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const setAvailability = async (available) => {
    setBusy(true);
    setError('');
    try {
      const result = await setMyAvailability(available);
      setStatus(result.availabilityStatus);
    } catch (err) {
      if (err.name !== 'SessionExpiredError') setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-[640px] mx-auto space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Profile</h1>
        <p className="text-[14px] text-slate-500">Your account identity and availability.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-4 pb-5 border-b border-slate-100">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-display font-bold text-xl shrink-0">
            {(user?.name || '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="font-display font-bold text-slate-900 text-[17px] truncate">{user?.name || 'Unknown'}</div>
            <span className="inline-block mt-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700">
              Field Worker
            </span>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          <Row icon={IconMail} label="Email" value={user?.email || '—'} />
          <Row icon={IconShieldCheck} label="User ID" value={user?.userId || '—'} />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-3">
        <h2 className="font-semibold text-slate-800 text-[15px]">Availability</h2>
        <p className="text-[13px] text-slate-500">
          {status === 'AVAILABLE' && (
            <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
              <IconCheckCircle size={14} /> Set to Available
            </span>
          )}
          {status === 'UNAVAILABLE' && (
            <span className="inline-flex items-center gap-1.5 text-slate-500 font-medium">Set to Off Duty</span>
          )}
          {status === null && 'Not confirmed yet — pick a status below.'}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setAvailability(true)}
            disabled={busy}
            className="px-4 py-2 rounded-lg text-[13px] font-semibold bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white transition-colors"
          >
            Available
          </button>
          <button
            onClick={() => setAvailability(false)}
            disabled={busy}
            className="px-4 py-2 rounded-lg text-[13px] font-semibold bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-600 transition-colors"
          >
            Off Duty
          </button>
        </div>
        {error && <p className="text-[13px] font-medium text-red-600">{error}</p>}
      </div>

      <UnavailableNote>
        There's no endpoint to read your current availability back — only to set it — so this page
        can't show a starting state, only what you last set this session.
      </UnavailableNote>
    </div>
  );
}
