// Overwrite a user's password. PATCH /users/{userId}/reset-password.
import React, { useState } from 'react';
import Modal from './Modal';
import { resetUserPassword } from '../../api/admin';

export default function ResetPasswordModal({ user, onDismiss, onDone }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await resetUserPassword(user.id, password);
      onDone(`Password reset for ${user.name}.`);
    } catch (err) {
      if (err.name !== 'SessionExpiredError') setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Reset password — ${user.name}`} onDismiss={onDismiss}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-[13px] text-slate-500">{user.email}</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password"
          autoFocus
          className="w-full bg-white rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-800 outline-none focus:border-primary transition"
        />
        {error && <p className="text-[13px] font-medium text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="w-full inline-flex items-center justify-center gap-2 bg-primary hover:bg-leaf-700 disabled:opacity-60 text-white font-semibold text-[13px] py-2.5 rounded-lg shadow-btn transition-colors"
        >
          {saving ? 'Resetting…' : 'Reset Password'}
        </button>
      </form>
    </Modal>
  );
}
