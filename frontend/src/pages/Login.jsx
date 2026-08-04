// Login page — universal for all four roles. The backend resolves the role
// from the credentials and returns it in the user object, so no role picker
// is needed here.
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import AuthCard from '../components/AuthCard';
import { FormField, TextInput, PasswordInput, Alert, SubmitButton } from '../components/formControls';
import { IconMail, IconLock } from '../components/icons';
import { login, saveSession, homePathForRole } from '../api/auth';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

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
      setMessage({ text: 'Logged in successfully. Redirecting…', type: 'success' });
      navigate(homePathForRole(data.user?.role), { replace: true });
    } catch (err) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard>
      <div className="mb-6 text-left">
        <h2 className="font-display text-[28px] font-bold text-[#f8fafc] tracking-tight mb-1.5">
          Authentication
        </h2>
        <div className="text-sm text-[#94a3b8]">
          New to the portal?{' '}
          <Link
            to="/register"
            className="text-primary font-semibold transition-fast hover:text-[#f8fafc] hover:underline"
          >
            Register here
          </Link>
        </div>
      </div>

      <Alert message={message} />

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <FormField label="Email">
          <TextInput
            icon={<IconMail />}
            type="email"
            placeholder="name@civicconnect.org"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </FormField>

        <FormField label="Password">
          <PasswordInput
            icon={<IconLock />}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </FormField>

        <SubmitButton loading={loading}>Login</SubmitButton>
      </form>
    </AuthCard>
  );
}
