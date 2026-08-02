// Account settings — shared across citizen, officer, admin and worker.
// There is no backend surface for notification preferences, theme, or a
// self-service password change, so this stays intentionally small: identity,
// a real logout, and an honest note about what isn't wired up yet.
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IconLogout } from '../../components/dashboard/icons';
import UnavailableNote from '../../components/dashboard/UnavailableNote';
import { getCurrentUser, clearSession } from '../../api/auth';

export default function Settings() {
  const navigate = useNavigate();
  const user = getCurrentUser();

  const handleLogout = () => {
    clearSession();
    navigate('/login', { replace: true });
  };

  return (
    <div className="max-w-[640px] mx-auto space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-[14px] text-slate-500">Session and account controls.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-slate-800 text-[15px]">Session</h2>
          <p className="text-[13px] text-slate-500 mt-1">
            Signed in as <span className="font-medium text-slate-700">{user?.email || 'unknown'}</span>.
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-700 font-semibold text-[14px] px-4 py-2.5 rounded-xl transition-colors"
        >
          <IconLogout size={16} /> Sign out
        </button>
      </div>

      <UnavailableNote>
        Notification preferences, theme, and a self-service password change aren't available yet —
        the backend has no endpoints for them. An administrator can reset your password if needed.
      </UnavailableNote>
    </div>
  );
}
