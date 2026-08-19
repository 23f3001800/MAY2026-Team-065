// Register page — citizens only. The other three roles (municipal_officer,
// field_worker, admin) are created by an admin on the backend, never here.
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import AuthShell, { AsidePoint } from '../components/public/AuthShell';
import { FormField, TextInput, PasswordInput, Alert, SubmitButton } from '../components/formControls';
import { IconUser, IconMail, IconLock, IconPhone, IconMapPin } from '../components/icons';
import { registerCitizen } from '../api/auth';

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    address: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const validate = () => {
    const { fullName, email, phoneNumber, address, password, confirmPassword } = form;
    if (!fullName.trim()) return 'Please enter your full name.';
    if (!email) return 'Please enter your email.';
    if (!phoneNumber.trim()) return 'Please enter your phone number.';
    if (!address.trim()) return 'Please enter your address.';
    if (password.length < 6) return 'Password must be at least 6 characters long.';
    if (password !== confirmPassword) return 'Passwords do not match.';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const error = validate();
    if (error) {
      setMessage({ text: error, type: 'error' });
      return;
    }
    setMessage({ text: '', type: '' });
    setLoading(true);
    try {
      await registerCitizen(form);
      setMessage({ text: 'Account created! Redirecting to login…', type: 'success' });
      setTimeout(() => navigate('/login', { replace: true }), 1500);
    } catch (err) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Create an account"
      subtitle="For residents reporting problems in their area."
      aside={(
        <>
          <h2 className="font-display text-[24px] font-bold leading-snug tracking-[-0.02em]">
            One account, and the council answers to it
          </h2>
          <ul className="space-y-4 mt-6">
            <AsidePoint label="A reference for every report">
              Not a form disappearing into an inbox — an identifier you can quote.
            </AsidePoint>
            <AsidePoint label="A date it is due by">
              Set from how urgent the problem is, visible from the moment you submit.
            </AsidePoint>
            <AsidePoint label="The last word is yours">
              Work is not closed until you confirm it, and you can reopen anything that was
              not really fixed.
            </AsidePoint>
          </ul>
          <p className="text-[12.5px] text-white/45 leading-relaxed mt-8">
            Your address is used to route reports to the right depot. It is not shown on any
            complaint you file.
          </p>
        </>
      )}
    >
      <Alert message={message} />

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <FormField label="Full Name">
          <TextInput
            icon={<IconUser />}
            type="text"
            placeholder="John Doe"
            value={form.fullName}
            onChange={set('fullName')}
            autoComplete="name"
            required
          />
        </FormField>

        <FormField label="Email">
          <TextInput
            icon={<IconMail />}
            type="email"
            placeholder="name@civicconnect.org"
            value={form.email}
            onChange={set('email')}
            autoComplete="email"
            required
          />
        </FormField>

        <FormField label="Phone Number">
          <TextInput
            icon={<IconPhone />}
            type="tel"
            placeholder="+91 90000 00000"
            value={form.phoneNumber}
            onChange={set('phoneNumber')}
            autoComplete="tel"
            required
          />
        </FormField>

        <FormField label="Address">
          <TextInput
            icon={<IconMapPin />}
            type="text"
            placeholder="House / Street, Area, City"
            value={form.address}
            onChange={set('address')}
            autoComplete="street-address"
            required
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4 max-[480px]:grid-cols-1">
          <FormField label="Password">
            <PasswordInput
              icon={<IconLock />}
              placeholder="••••••••"
              value={form.password}
              onChange={set('password')}
              autoComplete="new-password"
              required
            />
          </FormField>

          <FormField label="Confirm Password">
            <PasswordInput
              icon={<IconLock />}
              placeholder="••••••••"
              value={form.confirmPassword}
              onChange={set('confirmPassword')}
              autoComplete="new-password"
              required
            />
          </FormField>
        </div>

        <SubmitButton loading={loading}>Register</SubmitButton>
      </form>
      <p className="text-[14px] text-ink-muted mt-6">
        Already registered?{' '}
        <Link
          to="/login"
          className="focus-ring rounded font-semibold text-civic-700 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
