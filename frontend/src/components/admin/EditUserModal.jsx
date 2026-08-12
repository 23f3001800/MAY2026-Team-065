// Edit an existing account.
//
// Every field on a user is shown here, but they are not all editable, and the
// difference is the backend's, not a UI choice. PATCH /admin/users/{id} accepts
// exactly four things — isActive, role, department, skills — and of those:
//
//   department  persists, but only for a municipal officer
//   skills      does NOT persist: the handler writes `field_worker.skills`
//               while the column is `skillSet`, so SQLAlchemy sets a stray
//               Python attribute and the commit saves nothing
//   isActive    does NOT persist: UserModel has no such column
//   role        rejected by design (400) — create a new account instead
//
// Name, email and phone have no update path at all.
//
// A field that silently discards what an admin typed is worse than one that is
// visibly locked, so anything that cannot be saved is disabled and says why.
// The four backend changes needed to open these up are written down in
// docs/BACKEND_REQUESTS.md.
import React, { useMemo, useState } from 'react';
import Modal from './Modal';
import SkillPicker from './SkillPicker';
import { IconAlertTriangle, IconCheckCircle } from '../dashboard/icons';
import { updateUser } from '../../api/admin';
import { parseSkills, skillOptions } from '../../lib/skills';
import useCategories from '../../hooks/useCategories';

const inputClass =
  'w-full bg-white rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-800 outline-none focus:border-primary transition';
const lockedClass =
  'w-full bg-slate-50 rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-500 cursor-not-allowed';
const labelClass = 'block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1';

/** A field the backend cannot save, shown so the record is complete. */
function LockedField({ label, value, reason }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <input className={lockedClass} value={value || '—'} readOnly disabled />
      <p className="text-[11px] text-slate-400 mt-1">{reason}</p>
    </div>
  );
}

export default function EditUserModal({ user, onDismiss, onSaved }) {
  const isOfficer = String(user.role).toLowerCase() === 'officer'
    || String(user.role).toLowerCase() === 'municipal_officer';
  const isWorker = String(user.role).toLowerCase() === 'field_worker';

  const { categories } = useCategories();
  const departments = useMemo(() => skillOptions(categories), [categories]);

  const [department, setDepartment] = useState(user.department || '');
  const [skills, setSkills] = useState(() => parseSkills(user.skillSet));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const departmentChanged = isOfficer && department !== (user.department || '');

  const submit = async (e) => {
    e.preventDefault();
    if (!departmentChanged) {
      setError('Nothing here can be saved yet — see the notes on each field.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await updateUser(user.id, { department });
      onSaved(`${user.name}'s department set to ${department}.`);
    } catch (err) {
      if (err.name !== 'SessionExpiredError') setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Edit ${user.name}`} onDismiss={onDismiss}>
      <form onSubmit={submit} className="space-y-3.5">
        <LockedField
          label="Full name"
          value={user.name}
          reason="No endpoint updates a user's name."
        />
        <LockedField
          label="Email"
          value={user.email}
          reason="Email is the sign-in identifier and cannot be changed here."
        />
        <LockedField
          label="Phone"
          value={user.phone}
          reason="No endpoint updates a user's phone number."
        />
        <LockedField
          label="Role"
          value={user.roleLabel}
          reason="Changing a role is rejected by design — create a new account instead."
        />

        {isOfficer && (
          <div>
            <label className={labelClass} htmlFor="eu-dept">Department</label>
            <select
              id="eu-dept"
              className={inputClass}
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            >
              <option value="">Unassigned</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
              {/* A department that predates the current category list still has
                  to be selectable, or opening this form would silently move the
                  officer to Unassigned. */}
              {user.department && !departments.includes(user.department) && (
                <option value={user.department}>{user.department}</option>
              )}
            </select>
            <p className="flex items-center gap-1.5 text-[11px] text-emerald-700 mt-1">
              <IconCheckCircle size={12} /> This one saves.
            </p>
          </div>
        )}

        {isWorker && (
          <div>
            <span className={labelClass}>Skills</span>
            <SkillPicker value={skills} onChange={setSkills} disabled />
            <p className="flex items-start gap-1.5 text-[11px] text-amber-700 mt-1.5 leading-snug">
              <IconAlertTriangle size={12} className="shrink-0 mt-0.5" />
              <span>
                Read-only for now. The update endpoint writes to the wrong column, so a change
                here would report success and save nothing. Skills set when the worker is created
                do persist.
              </span>
            </p>
          </div>
        )}

        {!isOfficer && !isWorker && (
          <p className="text-[12.5px] text-slate-500 bg-slate-50 rounded-lg px-3 py-2.5">
            There is nothing editable on a {user.roleLabel.toLowerCase()} account. You can still
            reset the password from the user list.
          </p>
        )}

        {error && <p className="text-[13px] font-medium text-red-600">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onDismiss}
            className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-[13px] py-2.5 rounded-lg transition-colors"
          >
            Close
          </button>
          <button
            type="submit"
            disabled={saving || !departmentChanged}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-primary hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-[13px] py-2.5 rounded-lg shadow-btn transition-colors"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
