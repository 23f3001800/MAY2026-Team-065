// Sign in. Universal for all four roles — the backend resolves the role from
// the credentials, so there is no role picker to get wrong.
//
// The authentication logic is unchanged from the version this replaces; only
// the frame around it moved from the dark glass card to the civic shell.
import React, { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import AuthShell, { AsidePoint } from '../components/public/AuthShell';
import { FormField, TextInput, PasswordInput, Alert, SubmitButton } from '../components/formControls';
import { IconMail, IconLock } from '../components/icons';
import { login, saveSession, homePathForRole } from '../api/auth';

export default function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  // A session that timed out redirects here with ?expired=1. Saying so beats
  // leaving someone to wonder why they were thrown out mid-task.
  const [message, setMessage] = useState(() => (
    params.get('expired')
      ? { text: 'Your session ended. Please sign in again.', type: 'error' }
      : { text: '', type: '' }
  ));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setMessage({ text: 'Please enter your email and password.', type: 'error' });
      return;
    }
    setMessage({ text: '', type: '' });
    setLoading(true);
    try {
      const data = await login({ email, password });
      saveSession(data);
      setMessage({ text: 'Signed in. Taking you to your dashboard…', type: 'success' });
      navigate(homePathForRole(data.user?.role), { replace: true });
    } catch (err) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Sign in"
      subtitle="One account covers every role. We work out which one from your credentials."
      aside={(
        <>
          <h2 className="font-display text-[24px] font-bold leading-snug tracking-[-0.02em]">
            Your reports, and what happened to them
          </h2>
          <ul className="space-y-4 mt-6">
            <AsidePoint label="Everything you have filed">
              Each with its reference, the department handling it and the date it is due.
            </AsidePoint>
            <AsidePoint label="Evidence you can check">
              Before and after photographs, so "resolved" is something you can verify rather
              than take on trust.
            </AsidePoint>
            <AsidePoint label="Told when it moves">
              A notification at each stage, not a form you have to keep reopening.
            </AsidePoint>
          </ul>
        </>
      )}
    >
      <Alert message={message} />

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <FormField label="Email">
          <TextInput
            icon={<IconMail />}
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </FormField>

        <FormField label="Password">
          <PasswordInput
            icon={<IconLock />}
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </FormField>

        <SubmitButton loading={loading}>Sign in</SubmitButton>
      </form>

      <p className="text-[14px] text-ink-muted mt-6">
        Not registered yet?{' '}
        <Link
          to="/register"
          className="focus-ring rounded font-semibold text-civic-700 hover:underline"
        >
          Create an account
        </Link>
      </p>

      <p className="text-[12.5px] text-ink-faint mt-3 leading-relaxed">
        Officer, field worker and administrator accounts are created by an administrator, not
        through registration.
      </p>
    </AuthShell>
  );
}
