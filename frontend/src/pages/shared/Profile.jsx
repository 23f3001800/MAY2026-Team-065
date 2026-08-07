// Profile — identity, self-service edits, and the session controls that used to
// live on a separate Settings page.
//
// Two pages for "who am I" and "sign me out" was one too many; they are merged
// here and /settings redirects to this route.
//
// Identity is read from the decoded JWT (see api/auth.js userFromToken) because
// there is no GET /users/me. That is display data only — every request still
// re-verifies the signature server-side.
//
// Self-service editing is CITIZEN ONLY: the backend exposes
// /citizens/me/profile and /citizens/me/password and nothing equivalent for
// officers, workers or admins. Rather than show them a form that would 403,
// those roles get an explanation.
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconUser, IconMail, IconShieldCheck } from '../../components/icons';
import { IconLogout, IconCheckCircle } from '../../components/dashboard/icons';
import UnavailableNote from '../../components/dashboard/UnavailableNote';
import Toast from '../../components/dashboard/Toast';
import { getCurrentUser, clearSession } from '../../api/auth';
import { updateMyProfile, changeMyPassword } from '../../api/citizens';
import { resetUserPassword } from '../../api/admin';
import { ROLES } from '../../config';

function Row({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3.5 py-3.5">
      <span className="w-10 h-10 rounded-xl bg-slate-100 text-ink-muted flex items-center justify-center shrink-0">
        <Icon size={17} />
      </span>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</div>
        <div className="text-[14px] font-medium text-ink truncate">{value}</div>
      </div>
    </div>
  );
}

function Field({ label, hint, ...props }) {
  return (
    <label className="block">
      <span className="text-[12px] font-medium text-ink-body">{label}</span>
      <input
        {...props}
        className="focus-ring mt-1 w-full rounded-lg border border-line px-3 py-2 text-[14px] text-ink outline-none transition"
      />
      {hint && <span className="block text-[11px] text-ink-faint mt-1">{hint}</span>}
    </label>
  );
}

export default function Profile() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const roleLabel = ROLES[user?.role]?.label || user?.role || 'Unknown role';
  const isCitizen = user?.role === 'citizen';
  // PATCH /users/{id}/reset-password only checks that the CALLER is an
  // administrator -- it does not require the target to be someone else, so an
  // admin can use it on their own account. That is why admins get a password
  // form while officers and workers do not.
  const isAdmin = user?.role === 'admin';

  // There is no GET /citizens/me, so these start blank rather than prefilled.
  // Sending only what is filled in means a blank field leaves the stored value
  // alone instead of clearing it.
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [toast, setToast] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogout = () => {
    clearSession();
    navigate('/login', { replace: true });
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    const payload = {};
    if (name.trim() && name.trim() !== user?.name) payload.name = name.trim();
    if (phone.trim()) payload.phone = phone.trim();
    if (address.trim()) payload.address = address.trim();
    if (!Object.keys(payload).length) {
      setErrorMsg('Nothing to save — change a field first.');
      return;
    }
    setErrorMsg('');
    setSavingProfile(true);
    try {
      await updateMyProfile(payload);
      setToast('Profile updated.');
      setPhone('');
      setAddress('');
    } catch (err) {
      if (err.name !== 'SessionExpiredError') setErrorMsg(err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setErrorMsg('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('New passwords do not match.');
      return;
    }
    setErrorMsg('');
    setSavingPassword(true);
    try {
      if (isAdmin) {
        await resetUserPassword(user.userId, newPassword);
      } else {
        await changeMyPassword({ oldPassword, newPassword });
      }
      setToast('Password changed. It applies the next time you sign in.');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      if (err.name !== 'SessionExpiredError') setErrorMsg(err.message);
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="max-w-[640px] mx-auto space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Profile</h1>
        <p className="text-[14px] text-ink-muted">Your account, and where you sign out.</p>
      </div>

      <Toast message={toast} tone="success" onDismiss={() => setToast('')} />
      <Toast message={errorMsg} tone="error" onDismiss={() => setErrorMsg('')} autoHideMs={0} />

      {/* Identity */}
      <div className="bg-white rounded-2xl border border-line shadow-sm p-6">
        <div className="flex items-center gap-4 pb-5 border-b border-slate-100">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-primary flex items-center justify-center font-display font-bold text-xl shrink-0">
            {(user?.name || '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="font-display font-bold text-ink text-[17px] truncate">{user?.name || 'Unknown'}</div>
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

      {isCitizen || isAdmin ? (
        <>
          {/* Edit details — citizen-only; there is no admin self-profile endpoint. */}
          {isCitizen && (
          <form onSubmit={saveProfile} className="bg-white rounded-2xl border border-line shadow-sm p-6 space-y-4">
            <div>
              <h2 className="font-semibold text-ink text-[15px]">Edit details</h2>
              <p className="text-[13px] text-ink-muted mt-1">
                Leave a field blank to keep what is already stored. Your email cannot be changed here.
              </p>
            </div>
            <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            <Field label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Unchanged" />
            <Field label="Address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Unchanged" />
            <button
              type="submit"
              disabled={savingProfile}
              className="focus-ring inline-flex items-center gap-2 bg-primary hover:bg-emerald-600 disabled:opacity-60 text-white font-semibold text-[14px] px-4 py-2.5 rounded-xl shadow-btn transition-colors"
            >
              <IconCheckCircle size={16} /> {savingProfile ? 'Saving…' : 'Save changes'}
            </button>
          </form>
          )}

          {/* Change password */}
          <form onSubmit={savePassword} className="bg-white rounded-2xl border border-line shadow-sm p-6 space-y-4">
            <div>
              <h2 className="font-semibold text-ink text-[15px]">Change password</h2>
              <p className="text-[13px] text-ink-muted mt-1">
                {isAdmin
                  ? 'Administrators set a new password directly — the endpoint does not ask for the old one.'
                  : 'Your current password is required, so a borrowed session alone cannot change it.'}
              </p>
            </div>
            {!isAdmin && (
              <Field
                label="Current password" type="password" required autoComplete="current-password"
                value={oldPassword} onChange={(e) => setOldPassword(e.target.value)}
              />
            )}
            <Field
              label="New password" type="password" required autoComplete="new-password"
              value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
              hint="At least 8 characters."
            />
            <Field
              label="Confirm new password" type="password" required autoComplete="new-password"
              value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <button
              type="submit"
              disabled={savingPassword || (!isAdmin && !oldPassword) || !newPassword}
              className="focus-ring inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white font-semibold text-[14px] px-4 py-2.5 rounded-xl transition-colors"
            >
              {savingPassword ? 'Updating…' : 'Update password'}
            </button>
          </form>
        </>
      ) : (
        <UnavailableNote>
          Editing your details or password from here isn't available for this role — the backend
          exposes self-service endpoints for citizen accounts only. An administrator can update your
          record or reset your password.
        </UnavailableNote>
      )}

      {/* Session — moved here from the old Settings page. */}
      <div className="bg-white rounded-2xl border border-line shadow-sm p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-ink text-[15px]">Session</h2>
          <p className="text-[13px] text-ink-muted mt-1">
            Signed in as <span className="font-medium text-ink-body">{user?.email || 'unknown'}</span>.
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="focus-ring inline-flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-700 font-semibold text-[14px] px-4 py-2.5 rounded-xl transition-colors"
        >
          <IconLogout size={16} /> Sign out
        </button>
      </div>
    </div>
  );
}
