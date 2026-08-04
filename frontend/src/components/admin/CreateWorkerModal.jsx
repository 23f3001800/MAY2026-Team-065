// Create a Field Worker account. POST /workers/.
//
// skillSet is free text, and assignment later does a plain substring match
// against a complaint's department (see ComplaintDrawer), so it is worth
// typing full department names here -- "Roads & Transport", not "Roads".
import React, { useState } from 'react';
import Modal from './Modal';
import { createFieldWorker } from '../../api/workers';

const inputClass =
  'w-full bg-white rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-800 outline-none focus:border-primary transition';

export default function CreateWorkerModal({ onDismiss, onCreated }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', skillSet: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.phone || !form.password || !form.skillSet) {
      setError('All fields are required.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await createFieldWorker(form);
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
        <input className={inputClass} placeholder="Full name" value={form.name} onChange={set('name')} required />
        <input className={inputClass} type="email" placeholder="Email" value={form.email} onChange={set('email')} required />
        <input className={inputClass} placeholder="Phone" value={form.phone} onChange={set('phone')} required />
        <input className={inputClass} type="password" placeholder="Temporary password" value={form.password} onChange={set('password')} required />
        <input className={inputClass} placeholder="Skills (e.g. Roads & Transport, Sanitation)" value={form.skillSet} onChange={set('skillSet')} required />
        <p className="text-[11px] text-slate-400">
          Assignment matches this text against a complaint's department as a substring — spell out
          full department names for the best match.
        </p>
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
