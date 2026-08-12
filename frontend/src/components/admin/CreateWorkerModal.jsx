// Create a Field Worker account. POST /workers/.
//
// Skills are picked from the real department list rather than typed, because
// assignment substring-matches this text against a complaint's department — see
// lib/skills.js. Free text let an admin create a worker who could never be
// assigned anything, with nothing on screen explaining why.
import React, { useState } from 'react';
import Modal from './Modal';
import SkillPicker from './SkillPicker';
import { createFieldWorker } from '../../api/workers';
import { formatSkills } from '../../lib/skills';

const inputClass =
  'w-full bg-white rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-800 outline-none focus:border-primary transition';

const labelClass = 'block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1';

export default function CreateWorkerModal({ onDismiss, onCreated }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [skills, setSkills] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.phone || !form.password) {
      setError('Name, email, phone and a temporary password are all required.');
      return;
    }
    if (skills.length === 0) {
      setError('Pick at least one department — a worker with no skills is never offered any work.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await createFieldWorker({ ...form, skillSet: formatSkills(skills) });
      onCreated(`${form.name} added as a Field Worker.`);
    } catch (err) {
      if (err.name !== 'SessionExpiredError') setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Add Field Worker" onDismiss={onDismiss}>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className={labelClass} htmlFor="fw-name">Full name</label>
          <input id="fw-name" className={inputClass} value={form.name} onChange={set('name')} required />
        </div>
        <div>
          <label className={labelClass} htmlFor="fw-email">Email</label>
          <input id="fw-email" className={inputClass} type="email" value={form.email} onChange={set('email')} required />
        </div>
        <div>
          <label className={labelClass} htmlFor="fw-phone">Phone</label>
          <input id="fw-phone" className={inputClass} value={form.phone} onChange={set('phone')} required />
        </div>
        <div>
          <label className={labelClass} htmlFor="fw-pw">Temporary password</label>
          <input id="fw-pw" className={inputClass} type="password" value={form.password} onChange={set('password')} required />
          <p className="text-[11px] text-slate-400 mt-1">
            The worker signs in with this. It can be changed later from Reset password.
          </p>
        </div>

        <div>
          <span className={labelClass}>Skills</span>
          <SkillPicker value={skills} onChange={setSkills} />
          <p className="text-[11px] text-slate-400 mt-1.5">
            These are the departments whose complaints this worker can be assigned.
          </p>
        </div>

        {error && <p className="text-[13px] font-medium text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="w-full inline-flex items-center justify-center gap-2 bg-primary hover:bg-emerald-600 disabled:opacity-60 text-white font-semibold text-[13px] py-2.5 rounded-lg shadow-btn transition-colors"
        >
          {saving ? 'Creating…' : 'Create Field Worker'}
        </button>
      </form>
    </Modal>
  );
}
