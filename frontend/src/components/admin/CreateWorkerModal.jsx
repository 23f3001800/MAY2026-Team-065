// Create a Field Worker account. POST /workers/.
//
// Skills are picked from the real department list rather than typed, because
// assignment substring-matches this text against a complaint's department — see
// lib/skills.js. Free text let an admin create a worker who could never be
// assigned anything, with nothing on screen explaining why.
import React, { useState } from 'react';
import Modal from './Modal';
import SkillPicker from './SkillPicker';
import { Field, TextField, FormError, SubmitRow } from './formFields';
import { createFieldWorker } from '../../api/workers';
import { formatSkills } from '../../lib/skills';

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
      <form onSubmit={submit} className="space-y-3.5">
        <TextField
          id="fw-name"
          label="Full name"
          required
          value={form.name}
          onChange={set('name')}
        />
        <TextField
          id="fw-email"
          label="Email"
          type="email"
          required
          value={form.email}
          onChange={set('email')}
          hint="This is how they sign in. It must be unique."
        />
        <TextField
          id="fw-phone"
          label="Phone"
          required
          value={form.phone}
          onChange={set('phone')}
        />
        <TextField
          id="fw-password"
          label="Temporary password"
          type="password"
          required
          value={form.password}
          onChange={set('password')}
          hint="They can change it later from Reset password."
        />

        <Field id="fw-skills" label="Skills" required
          hint="The departments whose complaints this worker can be assigned. A worker with none is never offered work.">
          <SkillPicker value={skills} onChange={setSkills} />
        </Field>

        <FormError>{error}</FormError>

        <SubmitRow
          busy={saving}
          label="Create field worker"
          busyLabel="Creating…"
          onCancel={onDismiss}
        />
      </form>
    </Modal>
  );
}
