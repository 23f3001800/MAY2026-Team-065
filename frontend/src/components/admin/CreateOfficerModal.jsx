// Create a Municipal Officer account. POST /admin/users/official.
//
// The backend's SystemOfficialCreate schema also accepts role:
// "field_worker", but only the municipal_officer branch is implemented in
// main.py -- sending field_worker here 500s. Field workers are created
// through CreateWorkerModal (POST /workers/) instead, which is the endpoint
// actually built for it.
import React, { useState } from 'react';
import Modal from './Modal';
import { createOfficer } from '../../api/admin';

const inputClass =
  'w-full bg-white rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-800 outline-none focus:border-primary transition';

export default function CreateOfficerModal({ onDismiss, onCreated }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', department: '', designation: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) {
      setError('Name, email and password are required.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await createOfficer(form);
      onCreated(`${form.name} added as a Municipal Officer.`);
    } catch (err) {
      if (err.name !== 'SessionExpiredError') setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Add Municipal Officer" onDismiss={onDismiss}>
      <form onSubmit={submit} className="space-y-3">
        <input className={inputClass} placeholder="Full name" value={form.name} onChange={set('name')} required />
        <input className={inputClass} type="email" placeholder="Email" value={form.email} onChange={set('email')} required />
        <input className={inputClass} placeholder="Phone" value={form.phone} onChange={set('phone')} />
        <input className={inputClass} type="password" placeholder="Temporary password" value={form.password} onChange={set('password')} required />
        <input className={inputClass} placeholder="Department (e.g. Roads & Transport)" value={form.department} onChange={set('department')} />
        <input className={inputClass} placeholder="Designation (e.g. Senior Officer)" value={form.designation} onChange={set('designation')} />
        {error && <p className="text-[13px] font-medium text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="w-full inline-flex items-center justify-center gap-2 bg-primary hover:bg-emerald-600 disabled:opacity-60 text-white font-semibold text-[13px] py-2.5 rounded-lg shadow-btn transition-colors"
        >
          {saving ? 'Creating…' : 'Create Officer'}
        </button>
      </form>
    </Modal>
  );
}
