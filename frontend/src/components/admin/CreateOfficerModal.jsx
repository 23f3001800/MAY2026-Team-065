// Create a Municipal Officer account. POST /admin/users/official.
//
// Field workers go through CreateWorkerModal (POST /workers/) instead: that is
// the endpoint built for them, and it takes the skill set this form has no
// place for. Sending role=field_worker here is refused with a 400.
//
// Department and designation used to be free text, which is how the same job
// ended up recorded as "Roads", "roads & transport" and "Roads and Transport".
// Department decides which complaints an officer sees, so a typo there is not
// cosmetic — it quietly detaches them from their own queue. Both are now
// chosen from the real sets.
import React, { useMemo, useState } from 'react';
import Modal from './Modal';
import {
  TextField, SelectField, FormError, SubmitRow, DESIGNATIONS,
} from './formFields';
import { createOfficer } from '../../api/admin';
import { skillOptions } from '../../lib/skills';
import useCategories from '../../hooks/useCategories';

export default function CreateOfficerModal({ onDismiss, onCreated }) {
  const { categories } = useCategories();
  // The same list the complaints are routed by, so the two cannot drift.
  const departments = useMemo(() => skillOptions(categories), [categories]);

  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '',
    department: '', designation: 'Grievance Officer',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setError('Name, email and a temporary password are all required.');
      return;
    }
    if (!form.department) {
      setError('Choose a department — it decides which complaints this officer sees.');
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
      <form onSubmit={submit} className="space-y-3.5">
        <TextField
          id="of-name"
          label="Full name"
          required
          value={form.name}
          onChange={set('name')}
        />
        <TextField
          id="of-email"
          label="Email"
          type="email"
          required
          value={form.email}
          onChange={set('email')}
          hint="This is how they sign in. It must be unique."
        />
        <TextField
          id="of-phone"
          label="Phone"
          value={form.phone}
          onChange={set('phone')}
        />
        <TextField
          id="of-password"
          label="Temporary password"
          type="password"
          required
          value={form.password}
          onChange={set('password')}
          hint="They can change it later from Reset password."
        />

        <SelectField
          id="of-department"
          label="Department"
          required
          value={form.department}
          onChange={set('department')}
          options={departments}
          placeholder="Choose a department…"
          hint="Decides which complaints this officer is responsible for."
        />

        <SelectField
          id="of-designation"
          label="Designation"
          value={form.designation}
          onChange={set('designation')}
          options={DESIGNATIONS}
          placeholder="Choose a designation…"
        />

        <FormError>{error}</FormError>

        <SubmitRow
          busy={saving}
          label="Create officer"
          busyLabel="Creating…"
          onCancel={onDismiss}
        />
      </form>
    </Modal>
  );
}
