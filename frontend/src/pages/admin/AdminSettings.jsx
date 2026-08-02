// Admin Settings — identity, a real self password change, and logout.
//
// PATCH /users/{userId}/reset-password only checks that the caller's role is
// administrator; it doesn't require the target to be someone else. That
// makes it usable here for a genuine self-service password change, unlike
// every other role, which has no such option (see pages/shared/Settings.jsx).
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconLogout, IconCheckCircle } from '../../components/dashboard/icons';
import { IconMail, IconShieldCheck } from '../../components/icons';
import { getCurrentUser, clearSession } from '../../api/auth';
import { resetUserPassword } from '../../api/admin';

export default function AdminSettings() {
  const navigate = useNavigate();
  const user = getCurrentUser();

  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const handleLogout = () => {
    clearSession();
    navigate('/login', { replace: true });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await resetUserPassword(user.userId, password);
      setDone(true);
      setPassword('');
    } catch (err) {
      if (err.name !== 'SessionExpiredError') setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-[640px] mx-auto space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-[14px] text-slate-500">Account, password, and session controls.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-1">
        <div className="flex items-center gap-3 py-2">
          <span className="w-9 h-9 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center shrink-0"><IconMail size={15} /></span>
          <span className="text-[13px] text-slate-700">{user?.email}</span>
        </div>
        <div className="flex items-center gap-3 py-2">
          <span className="w-9 h-9 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center shrink-0"><IconShieldCheck size={15} /></span>
          <span className="text-[13px] text-slate-700">Administrator</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-3">
        <h2 className="font-semibold text-slate-800 text-[15px]">Change Password</h2>
        <form onSubmit={submit} className="space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setDone(false); }}
            placeholder="New password"
            className="w-full bg-white rounded-lg border border-slate-200 px-3 py-2.5 text-[13px] text-slate-800 outline-none focus:border-primary transition"
          />
          {error && <p className="text-[13px] font-medium text-red-600">{error}</p>}
          {done && (
            <p className="flex items-center gap-1.5 text-[13px] font-medium text-emerald-700">
              <IconCheckCircle size={14} /> Password updated.
            </p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 bg-primary hover:bg-emerald-600 disabled:opacity-60 text-white font-semibold text-[13px] px-4 py-2.5 rounded-lg shadow-btn transition-colors"
          >
            {saving ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-700 font-semibold text-[14px] px-4 py-2.5 rounded-xl transition-colors"
        >
          <IconLogout size={16} /> Sign out
        </button>
      </div>
    </div>
  );
}
