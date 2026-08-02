// Account identity — shared across citizen, officer and admin (the field
// worker gets a richer version at pages/worker/WorkerProfile.jsx that also
// carries the availability toggle).
//
// The backend has no GET /users/me or self-update endpoint, so this reads
// straight from the decoded JWT (see api/auth.js userFromToken) rather than
// making a call that doesn't exist. That is display data only; every request
// still re-verifies the signature server-side.
import React from 'react';
import { IconUser, IconMail, IconShieldCheck } from '../../components/icons';
import UnavailableNote from '../../components/dashboard/UnavailableNote';
import { getCurrentUser } from '../../api/auth';
import { ROLES } from '../../config';

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

export default function Profile() {
  const user = getCurrentUser();
  const roleLabel = ROLES[user?.role]?.label || user?.role || 'Unknown role';

  return (
    <div className="max-w-[640px] mx-auto space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Profile</h1>
        <p className="text-[14px] text-slate-500">Your account identity in SmartCivicConnect.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-4 pb-5 border-b border-slate-100">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-primary flex items-center justify-center font-display font-bold text-xl shrink-0">
            {(user?.name || '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="font-display font-bold text-slate-900 text-[17px] truncate">{user?.name || 'Unknown'}</div>
            <span className="inline-block mt-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-violet-50 text-violet-700">
              {roleLabel}
            </span>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          <Row icon={IconMail} label="Email" value={user?.email || '—'} />
          <Row icon={IconShieldCheck} label="Role" value={roleLabel} />
          <Row icon={IconUser} label="User ID" value={user?.userId || '—'} />
        </div>
      </div>

      <UnavailableNote>
        Editing your name, phone or password from here isn't available yet — the backend has no
        self-service profile endpoint. An administrator can reset your password if you're locked out.
      </UnavailableNote>
    </div>
  );
}
