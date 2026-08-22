// Getting back into an account you cannot sign in to.
//
// Three steps, one screen. The email address has to survive all three calls, so
// splitting them across three routes would mean carrying it in the URL -- which
// puts it in history and in any shared link -- or losing it on a refresh. One
// route with a step keeps it in memory where it belongs, and the back link
// between steps costs nothing.
//
// Two things this screen must not do:
//
//   * say whether the address is registered. The server answers 202 either way
//     and so does this page, because anything else turns the form into a way of
//     testing who is on the citizen register.
//   * make people type six digits into six separate boxes. The code arrives in
//     an email, usually on a phone, and what everybody actually does is copy
//     it. One field that accepts a paste is the whole requirement.
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthShell, { AuthCard, NavLink } from '../components/auth/AuthShell';
import { CityLineArt } from '../components/auth/AuthScene';
import {
  TextInput, PasswordInput, Badge, Alert, SubmitButton, SecurityNote, InlineAction,
} from '../components/auth/controls';
import { IconMail, IconLock, IconShieldCheck, IconCheckCircle } from '../components/icons';
import {
  requestPasswordReset, verifyResetCode, resetPassword, MIN_PASSWORD_LENGTH,
} from '../api/auth';

const STEPS = [
  { key: 'email', label: 'Your email' },
  { key: 'code', label: 'Verify code' },
  { key: 'password', label: 'New password' },
];

// Six digits is what the server issues. Non-digits are stripped on the way in,
// so a code pasted as "123 456" or with a trailing space still works.
const CODE_LENGTH = 6;

function cleanCode(value) {
  return value.replace(/\D/g, '').slice(0, CODE_LENGTH);
}

function Stepper({ current }) {
  return (
    <ol className="mt-6 flex items-center gap-2" aria-label="Progress">
      {STEPS.map((s, i) => {
        const state = i < current ? 'done' : i === current ? 'now' : 'todo';
        return (
          <li key={s.key} className="flex flex-1 items-center gap-2">
            <span
              aria-current={state === 'now' ? 'step' : undefined}
              className={`flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                state === 'todo' ? 'bg-[#eef2f0] text-[#93a49b]' : 'bg-[#0f7f43] text-white'
              }`}
            >
              {state === 'done' ? '✓' : i + 1}
            </span>
            <span
              className={`hidden text-[12px] font-semibold sm:inline ${
                state === 'todo' ? 'text-[#93a49b]' : 'text-ink-body'
              }`}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <span
                aria-hidden="true"
                className={`ml-1 h-px flex-1 ${i < current ? 'bg-[#0f7f43]' : 'bg-[#e2e9e5]'}`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default function ForgotPassword() {
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  // Read from the response rather than assumed: the lifetime is configurable,
  // and telling somebody "15 minutes" when it is really 5 is worse than saying
  // nothing at all.
  const [expiresInMinutes, setExpiresInMinutes] = useState(null);

  const say = (text, type = 'error') => setMessage({ text, type });

  // ── Step 1: ask for a code ──────────────────────────────────────
  const sendCode = async (e, { resend = false } = {}) => {
    if (e) e.preventDefault();
    if (!email.trim()) {
      say('Enter the email address on your account.');
      return;
    }

    setLoading(true);
    setMessage({ text: '', type: '' });
    try {
      const res = await requestPasswordReset(email);
      setExpiresInMinutes(res?.expiresInMinutes ?? null);
      // The server's wording is already carefully non-committal about whether
      // the account exists. Pass it through rather than writing our own.
      say(res?.message || 'If that address has an account, a code is on its way.', 'success');
      setStep(1);
      if (resend) setCode('');
    } catch (err) {
      say(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: check it, without spending it ───────────────────────
  const checkCode = async (e) => {
    e.preventDefault();
    if (code.length < 4) {
      say('Enter the code from the email.');
      return;
    }

    setLoading(true);
    setMessage({ text: '', type: '' });
    try {
      const res = await verifyResetCode({ email, code });
      // On failure the 400 detail counts down the attempts left on this code,
      // which is the most useful thing anybody can be told here, so it is shown
      // as sent. On success the only number worth keeping is the time left.
      setExpiresInMinutes(res?.expiresInMinutes ?? null);
      setStep(2);
      setMessage({ text: '', type: '' });
    } catch (err) {
      say(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: spend it ────────────────────────────────────────────
  const choosePassword = async (e) => {
    e.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      say(`Your new password needs at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      say('Those two passwords do not match.');
      return;
    }

    setLoading(true);
    setMessage({ text: '', type: '' });
    try {
      await resetPassword({ email, code, newPassword: password });
      navigate('/login?reset=1', { replace: true });
    } catch (err) {
      // A code can expire or run out of attempts between step two and step
      // three. Nothing on this step can fix that, so send them back to where a
      // new one can be asked for rather than leaving them retyping a password
      // against a code that is already dead.
      say(err.message);
      if (/expired|new one|not correct|no longer/i.test(err.message || '')) setStep(1);
    } finally {
      setLoading(false);
    }
  };

  const ttlNote = expiresInMinutes
    ? `The code is good for about ${expiresInMinutes} minute${expiresInMinutes === 1 ? '' : 's'}.`
    : null;

  return (
    <AuthShell nav={<NavLink prompt="Remembered it?" to="/login" label="Back to login" />}>
      <AuthCard className="max-w-[980px]">
        <div className="grid gap-4 lg:grid-cols-[1fr_0.88fr]">
          {/* ── Form ───────────────────────────────────────────── */}
          <div className="flex flex-col px-3 py-6 sm:px-7 sm:py-8">
            <Badge icon={<IconShieldCheck size={15} />}>Account recovery</Badge>

            <h1 className="mt-5 font-display text-[30px] font-bold leading-tight tracking-[-0.5px] text-ink">
              {step === 0 && 'Reset your password'}
              {step === 1 && 'Check your email'}
              {step === 2 && 'Choose a new password'}
            </h1>
            <p className="mt-2.5 max-w-[330px] text-[14.5px] leading-[1.6] text-ink-muted">
              {step === 0 && 'Tell us the address on your account and we will send a verification code to it.'}
              {step === 1 && (
                <>
                  We sent a {CODE_LENGTH}-digit code to{' '}
                  <strong className="text-ink-body">{email}</strong>. Paste it below.
                  {ttlNote ? ` ${ttlNote}` : ''}
                </>
              )}
              {step === 2 && 'That code checked out. Pick something you have not used here before.'}
            </p>

            <Stepper current={step} />

            {step === 0 && (
              <form className="mt-6 flex flex-col gap-3.5" onSubmit={sendCode}>
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
                <SubmitButton loading={loading} icon={<IconMail size={17} />}>
                  Send verification code
                </SubmitButton>
                <p className="text-center text-[12.5px] text-ink-faint">
                  <Link to="/login" className="font-semibold text-[#0f7f43] hover:underline">
                    Back to login
                  </Link>
                </p>
              </form>
            )}

            {step === 1 && (
              <form className="mt-6 flex flex-col gap-3.5" onSubmit={checkCode}>
                <Alert message={message} />
                <TextInput
                  icon={<IconLock size={17} />}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder={'0'.repeat(CODE_LENGTH)}
                  aria-label="Verification code"
                  value={code}
                  onChange={(e) => setCode(cleanCode(e.target.value))}
                  required
                />
                <SubmitButton loading={loading} icon={<IconCheckCircle size={17} />}>
                  Verify code
                </SubmitButton>
                <div className="flex items-center justify-between gap-3 text-[12.5px]">
                  <InlineAction onClick={() => { setStep(0); setMessage({ text: '', type: '' }); }}>
                    Use a different address
                  </InlineAction>
                  <InlineAction onClick={() => sendCode(null, { resend: true })}>
                    Send another code
                  </InlineAction>
                </div>
                <p className="text-[12px] leading-[1.6] text-ink-faint">
                  Nothing arrived? Check spam. Asking for another code retires the previous
                  one, so use the most recent email.
                </p>
              </form>
            )}

            {step === 2 && (
              <form className="mt-6 flex flex-col gap-3.5" onSubmit={choosePassword}>
                <Alert message={message} />
                <PasswordInput
                  icon={<IconLock size={17} />}
                  placeholder={`New password (at least ${MIN_PASSWORD_LENGTH} characters)`}
                  aria-label="New password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
                <PasswordInput
                  icon={<IconLock size={17} />}
                  placeholder="Confirm new password"
                  aria-label="Confirm new password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  required
                />
                <SubmitButton loading={loading} icon={<IconShieldCheck size={17} />}>
                  Set new password
                </SubmitButton>
                {ttlNote && (
                  <p className="text-[12px] leading-[1.6] text-ink-faint">
                    {ttlNote} If it runs out, ask for a new one and start again.
                  </p>
                )}
              </form>
            )}

            <div className="mt-auto pt-8">
              <SecurityNote />
            </div>
          </div>

          {/* ── Brand pane ─────────────────────────────────────── */}
          <aside className="hidden flex-col justify-center rounded-[20px] bg-[linear-gradient(160deg,#1c6041_0%,#124a31_100%)] px-8 py-10 text-white lg:flex">
            <CityLineArt className="mx-auto w-[220px] text-white/[0.85]" />

            <h2 className="mt-9 font-display text-[23px] font-bold leading-[1.3] tracking-[-0.3px]">
              Locked out?<br />You can fix that yourself
            </h2>
            <p className="mt-3.5 text-[13.5px] leading-[1.7] text-white/[0.72]">
              Anyone who can read the inbox on the account can set a new password. No
              administrator ever has to choose it, or know it.
            </p>

            <ul className="mt-8 flex flex-col gap-4 text-[13px] leading-[1.6] text-white/[0.75]">
              <li>The code lasts a few minutes and only works once.</li>
              <li>Asking for a new code retires the previous one.</li>
              <li>We never say whether an address has an account.</li>
            </ul>
          </aside>
        </div>
      </AuthCard>
    </AuthShell>
  );
}
