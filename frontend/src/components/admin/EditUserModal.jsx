// Edit an existing account.
//
// This screen used to be almost entirely read-only, because PATCH
// /admin/users/{id} answered "User updated successfully" while saving nothing:
// it wrote `field_worker.skills` where the column is `skillSet`. Locking the
// fields was the honest choice at the time — an input that silently discards
// what an administrator typed is worse than one that plainly cannot be used.
//
// The backend now persists name, email, phone, department, skills and the
// active flag, and returns the updated record, so the fields are live.
//
// Two guardrails remain, and they are deliberate:
//
//   role       still fixed. Changing it means moving the row between the
//              polymorphic subclass tables, which is a new account, not an edit.
//   suspension refused while the account still holds open work, because a
//              complaint whose officer or worker cannot sign in is stuck with
//              nobody able to move it and nothing on screen saying why.
import React, { useMemo, useState } from 'react';
import Modal from './Modal';
import SkillPicker from './SkillPicker';
import { IconAlertTriangle, IconCheckCircle } from '../dashboard/icons';
import { updateUser, deactivateUser } from '../../api/admin';
import { parseSkills, skillOptions } from '../../lib/skills';
import useCategories from '../../hooks/useCategories';

const inputClass =
  'w-full bg-white rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-800 outline-none focus:border-primary transition';
const lockedClass =
  'w-full bg-slate-50 rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-500 cursor-not-allowed';
const labelClass = 'block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1';

function Field({ label, value, onChange, type = 'text', hint, id }) {
  return (
    <div>
      <label className={labelClass} htmlFor={id}>{label}</label>
      <input id={id} type={type} className={inputClass} value={value} onChange={onChange} />
      {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

export default function EditUserModal({ user, onDismiss, onSaved, openWorkCount = null }) {
  const role = String(user.role).toLowerCase();
  const isOfficer = role === 'officer' || role === 'municipal_officer';
  const isWorker = role === 'field_worker';
  const isAdmin = role === 'administrator' || role === 'admin';

  const { categories } = useCategories();
  const departments = useMemo(() => skillOptions(categories), [categories]);

  const [form, setForm] = useState({
    name: user.name || '',
    email: user.email || '',
    phone: user.phone || '',
    department: user.department || '',
  });
  const [skills, setSkills] = useState(() => parseSkills(user.skillSet));
  const [active, setActive] = useState(user.isActive !== false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  const set = (key) => (e) => {
    setSaved('');
    setForm((f) => ({ ...f, [key]: e.target.value }));
  };

  // Only send what actually changed, so an unrelated field cannot be clobbered
  // by a stale value this form was opened with.
  const changes = useMemo(() => {
    const out = {};
    if (form.name.trim() !== (user.name || '')) out.name = form.name.trim();
    if (form.email.trim() !== (user.email || '')) out.email = form.email.trim();
    if (form.phone.trim() !== (user.phone || '')) out.phone = form.phone.trim();
    if (isOfficer && form.department !== (user.department || '')) {
      out.department = form.department;
    }
    if (isWorker) {
      const before = parseSkills(user.skillSet).join('|');
      if (skills.join('|') !== before) out.skills = skills;
    }
    return out;
  }, [form, skills, user, isOfficer, isWorker]);

  const dirty = Object.keys(changes).length > 0;

  // Suspending someone who still holds open complaints strands that work: the
  // record keeps pointing at an account that can no longer sign in.
  const holdsWork = typeof openWorkCount === 'number' && openWorkCount > 0;
  const suspendBlocked = active && holdsWork;

  const save = async (e) => {
    e.preventDefault();
    if (!dirty) return;
    setSaving(true);
    setError('');
    try {
      const updated = await updateUser(user.id, changes);
      setSaved('Saved.');
      onSaved(updated, `${updated.name || user.name} updated.`);
    } catch (err) {
      if (err.name !== 'SessionExpiredError') setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async () => {
    setSaving(true);
    setError('');
    try {
      const updated = active
        ? await deactivateUser(user.id)
        : await updateUser(user.id, { isActive: true });
      setActive(updated.isActive !== false);
      onSaved(
        updated,
        active
          ? `${user.name} suspended — they can no longer sign in.`
          : `${user.name} reactivated.`,
      );
    } catch (err) {
      if (err.name !== 'SessionExpiredError') setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Edit ${user.name}`} onDismiss={onDismiss}>
      <form onSubmit={save} className="space-y-3.5">
        <Field id="eu-name" label="Full name" value={form.name} onChange={set('name')} />
        <Field
          id="eu-email"
          label="Email"
          type="email"
          value={form.email}
          onChange={set('email')}
          hint="This is the sign-in identifier. It must stay unique."
        />
        <Field id="eu-phone" label="Phone" value={form.phone} onChange={set('phone')} />

        <div>
          <label className={labelClass}>Role</label>
          <input className={lockedClass} value={user.roleLabel} readOnly disabled />
          <p className="text-[11px] text-slate-400 mt-1">
            Roles cannot be changed — each lives in its own table, so a different role is a new
            account.
          </p>
        </div>

        {isOfficer && (
          <div>
            <label className={labelClass} htmlFor="eu-dept">Department</label>
            <select
              id="eu-dept"
              className={inputClass}
              value={form.department}
              onChange={set('department')}
            >
              <option value="">Unassigned</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
              {/* A department predating the current category list still has to
                  be selectable, or opening this form would quietly move the
                  officer to Unassigned. */}
              {user.department && !departments.includes(user.department) && (
                <option value={user.department}>{user.department}</option>
              )}
            </select>
          </div>
        )}

        {isWorker && (
          <div>
            <span className={labelClass}>Skills</span>
            <SkillPicker value={skills} onChange={setSkills} />
            <p className="text-[11px] text-slate-400 mt-1.5">
              These decide which complaints this worker can be assigned. A worker with none is
              never offered work.
            </p>
          </div>
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
            disabled={saving || !dirty}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-primary hover:bg-leaf-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-[13px] py-2.5 rounded-lg shadow-btn transition-colors"
          >
            {saving ? 'Saving…' : dirty ? 'Save changes' : 'No changes'}
          </button>
        </div>

        {saved && (
          <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-emerald-700">
            <IconCheckCircle size={13} /> {saved}
          </p>
        )}
      </form>

      {/* Access is a separate decision from the details above, so it is a
          separate control rather than another field in the form. */}
      <div className="mt-5 pt-4 border-t border-slate-200">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-slate-800">
              {active ? 'Account is active' : 'Account is suspended'}
            </div>
            <p className="text-[12px] text-slate-500 mt-0.5 leading-snug">
              {active
                ? 'Suspending blocks sign-in immediately, including tokens already issued.'
                : 'This account cannot sign in. Their record and history are intact.'}
            </p>
          </div>
          <button
            type="button"
            onClick={toggleActive}
            disabled={saving || suspendBlocked}
            className={`shrink-0 px-3.5 py-2 rounded-lg text-[13px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              active
                ? 'bg-white border border-red-200 text-red-700 hover:bg-red-50'
                : 'bg-emerald-500 hover:bg-leaf-700 text-white'
            }`}
          >
            {active ? 'Suspend' : 'Reactivate'}
          </button>
        </div>

        {suspendBlocked && (
          <p className="flex items-start gap-1.5 text-[11.5px] text-amber-700 mt-2 leading-snug">
            <IconAlertTriangle size={12} className="shrink-0 mt-0.5" />
            <span>
              Still holds {openWorkCount} open complaint{openWorkCount === 1 ? '' : 's'}.
              Reassign {openWorkCount === 1 ? 'it' : 'them'} first — suspending now would leave
              {openWorkCount === 1 ? ' it' : ' them'} pointing at an account that cannot sign in.
            </span>
          </p>
        )}

        {isAdmin && (
          <p className="text-[11.5px] text-slate-400 mt-2">
            An administrator cannot suspend their own account; the server refuses it.
          </p>
        )}
      </div>
    </Modal>
  );
}
