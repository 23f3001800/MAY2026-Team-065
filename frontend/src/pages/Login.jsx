// Login page — universal for all four roles. The backend resolves the role
// from the credentials and returns it in the user object, so no role picker
// is needed here.
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthShell, { AuthCard, NavLink } from '../components/auth/AuthShell';
import { CityLineArt } from '../components/auth/AuthScene';
import {
  TextInput, PasswordInput, Checkbox, InlineAction, Badge, Alert, SubmitButton, SecurityNote,
} from '../components/auth/controls';
import { IconMail, IconLock, IconMegaphone, IconCheckCircle, IconUsers } from '../components/icons';
import { login, saveSession, homePathForRole } from '../api/auth';

const FEATURES = [
  { icon: <IconMegaphone size={17} />, title: 'Report Issues', body: 'Easily report civic issues in your area' },
  { icon: <IconCheckCircle size={17} />, title: 'Track Progress', body: 'Follow updates in real-time' },
  { icon: <IconUsers size={17} />, title: 'Community Driven', body: 'Stronger communities start with you' },
];

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
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
    <AuthShell nav={<NavLink prompt="New here?" to="/register" label="Register here" />}>
      <AuthCard className="max-w-[980px]">
        <div className="grid gap-4 lg:grid-cols-[1fr_0.88fr]">
          {/* ── Form ───────────────────────────────────────────── */}
          <div className="flex flex-col px-3 py-6 sm:px-7 sm:py-8">
            <Badge icon={<span aria-hidden="true">👋</span>}>Welcome back!</Badge>

            <h1 className="mt-5 font-display text-[30px] font-bold leading-tight tracking-[-0.5px] text-ink">
              Login to your account
            </h1>
            <p className="mt-2.5 max-w-[300px] text-[14.5px] leading-[1.6] text-ink-muted">
              Access your dashboard and stay connected with your community.
            </p>

            <form className="mt-7 flex flex-col gap-3.5" onSubmit={handleSubmit}>
              <Alert message={message} />

              <TextInput
                icon={<IconMail size={17} />}
                type="email"
                placeholder="Email address"
                aria-label="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />

              <PasswordInput
                icon={<IconLock size={17} />}
                placeholder="Password"
                aria-label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />

              <div className="flex items-center justify-between gap-3 py-0.5 text-[13px]">
                <Checkbox id="remember" checked={remember} onChange={(e) => setRemember(e.target.checked)}>
                  Remember me
                </Checkbox>
                <InlineAction
                  onClick={() =>
                    setMessage({
                      text: 'Password reset isn’t available yet — please contact your ward administrator.',
                      type: 'info',
                    })
                  }
                >
                  Forgot password?
                </InlineAction>
              </div>

              <SubmitButton loading={loading} icon={<IconLock size={17} />}>
                Login
              </SubmitButton>
            </form>

            <div className="mt-auto pt-8">
              <SecurityNote />
            </div>
          </div>

          {/* ── Brand pane ─────────────────────────────────────── */}
          <aside className="hidden flex-col justify-center rounded-[20px] bg-[linear-gradient(160deg,#1c6041_0%,#124a31_100%)] px-8 py-10 text-white lg:flex">
            <CityLineArt className="mx-auto w-[220px] text-white/[0.85]" />

            <h2 className="mt-9 font-display text-[23px] font-bold leading-[1.3] tracking-[-0.3px]">
              Building better<br />communities together
            </h2>
            <p className="mt-3.5 text-[13.5px] leading-[1.7] text-white/[0.72]">
              SmartCivicConnect helps you report issues, track progress, and stay informed about what
              matters in your neighborhood.
            </p>

            <ul className="mt-8 flex flex-col gap-5">
              {FEATURES.map((f) => (
                <li key={f.title} className="flex items-start gap-3.5">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[11px] bg-white/[0.12] text-white">
                    {f.icon}
                  </span>
                  <span>
                    <span className="block text-[14px] font-semibold">{f.title}</span>
                    <span className="mt-0.5 block text-[12.5px] leading-[1.5] text-white/[0.65]">{f.body}</span>
                  </span>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </AuthCard>
    </AuthShell>
  );
}
