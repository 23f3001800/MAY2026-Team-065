// Register page — citizens only. The other three roles (municipal_officer,
// field_worker, admin) are created by an admin on the backend, never here.
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthShell, { AuthCard, NavLink } from '../components/auth/AuthShell';
import { ParkScene } from '../components/auth/AuthScene';
import {
  Field, TextInput, PasswordInput, Checkbox, InlineAction, Badge, Alert, SubmitButton, SecurityNote,
} from '../components/auth/controls';
import {
  IconUser, IconMail, IconLock, IconPhone, IconMapPin, IconUsers, IconSparkle, IconShieldCheck,
} from '../components/icons';
import { registerCitizen } from '../api/auth';

const STATS = [
  { icon: <IconShieldCheck size={17} />, value: '1,000+', label: 'Issues Resolved' },
  { icon: <IconUsers size={17} />, value: '500+', label: 'Active Citizens' },
  { icon: <IconMapPin size={17} />, value: '20+', label: 'Wards Covered' },
];

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
  const [agreed, setAgreed] = useState(false);
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
    if (!agreed) return 'Please accept the Terms of Service and Privacy Policy.';
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

  const showLegalNote = () =>
    setMessage({
      text: 'Our Terms of Service and Privacy Policy will be published before launch.',
      type: 'info',
    });

  return (
    <AuthShell nav={<NavLink prompt="Already have an account?" to="/login" label="Sign in" />}>
      <AuthCard className="max-w-[1020px]">
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          {/* ── Form ───────────────────────────────────────────── */}
          <div className="flex flex-col px-3 py-6 sm:px-7 sm:py-7">
            <Badge icon={<IconSparkle size={13} />}>Create your account</Badge>

            <h1 className="mt-4 font-display text-[29px] font-bold leading-tight tracking-[-0.5px] text-ink">
              Join SmartCivicConnect
            </h1>
            <p className="mt-2 max-w-[330px] text-[14.5px] leading-[1.6] text-ink-muted">
              Let’s build a cleaner, safer and smarter community together.
            </p>

            <form className="mt-6 flex flex-col gap-3.5" onSubmit={handleSubmit}>
              <Alert message={message} />

              <Field label="Full Name" htmlFor="fullName">
                <TextInput
                  id="fullName"
                  icon={<IconUser size={17} />}
                  type="text"
                  placeholder="Enter your full name"
                  value={form.fullName}
                  onChange={set('fullName')}
                  autoComplete="name"
                  required
                />
              </Field>

              <div className="grid gap-3.5 sm:grid-cols-2">
                <Field label="Email" htmlFor="email">
                  <TextInput
                    id="email"
                    icon={<IconMail size={17} />}
                    type="email"
                    placeholder="Enter your email"
                    value={form.email}
                    onChange={set('email')}
                    autoComplete="email"
                    required
                  />
                </Field>

                <Field label="Phone Number" htmlFor="phone">
                  <TextInput
                    id="phone"
                    icon={<IconPhone size={17} />}
                    type="tel"
                    placeholder="Enter your phone"
                    value={form.phoneNumber}
                    onChange={set('phoneNumber')}
                    autoComplete="tel"
                    required
                  />
                </Field>
              </div>

              <Field label="Address" htmlFor="address">
                <TextInput
                  id="address"
                  icon={<IconMapPin size={17} />}
                  type="text"
                  placeholder="House / Street, Area, City"
                  value={form.address}
                  onChange={set('address')}
                  autoComplete="street-address"
                  required
                />
              </Field>

              <Field label="Password" htmlFor="password">
                <PasswordInput
                  id="password"
                  icon={<IconLock size={17} />}
                  placeholder="Create a password"
                  value={form.password}
                  onChange={set('password')}
                  autoComplete="new-password"
                  required
                />
              </Field>

              <Field label="Confirm Password" htmlFor="confirmPassword">
                <PasswordInput
                  id="confirmPassword"
                  icon={<IconLock size={17} />}
                  placeholder="Confirm your password"
                  value={form.confirmPassword}
                  onChange={set('confirmPassword')}
                  autoComplete="new-password"
                  required
                />
              </Field>

              <div className="pt-0.5">
                <Checkbox id="terms" checked={agreed} onChange={(e) => setAgreed(e.target.checked)}>
                  I agree to the <InlineAction onClick={showLegalNote}>Terms of Service</InlineAction>{' '}
                  and <InlineAction onClick={showLegalNote}>Privacy Policy</InlineAction>
                </Checkbox>
              </div>

              <SubmitButton loading={loading} icon={<IconUsers size={17} />}>
                Register
              </SubmitButton>
            </form>

            <div className="mt-6">
              <SecurityNote />
            </div>
          </div>

          {/* ── Brand pane ─────────────────────────────────────── */}
          <aside className="hidden flex-col rounded-[20px] border border-[#e3efe8] bg-[#f3f9f5] p-6 lg:flex">
            <ParkScene className="h-[190px] w-full rounded-[14px]" />

            <h2 className="mt-8 font-display text-[23px] font-bold leading-[1.3] tracking-[-0.3px] text-ink">
              Be a part of<br />the change
            </h2>
            <p className="mt-3 text-[13.5px] leading-[1.7] text-ink-muted">
              Your voice matters. Together, we can create a better environment for everyone.
            </p>

            <ul className="mt-8 flex flex-col gap-5">
              {STATS.map((s) => (
                <li key={s.label} className="flex items-center gap-3.5">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[11px] bg-[#e2f1e8] text-[#0f7f43]">
                    {s.icon}
                  </span>
                  <span>
                    <span className="block font-display text-[16px] font-bold text-ink">{s.value}</span>
                    <span className="mt-0.5 block text-[12.5px] text-ink-muted">{s.label}</span>
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
