// Light-theme form controls for the auth screens. Kept in one file so Login and
// Register can never drift apart — the brand green below is the single source
// for both.
import React from 'react';
import { IconEye, IconEyeOff, IconInfo, IconShieldCheck } from '../icons';

// Focus ring written as an explicit shadow rather than `ring-*`: the value is a
// tinted brand green at an opacity Tailwind has no step for.
const INPUT_CLASS =
  'w-full h-[46px] rounded-xl border border-[#dfe6e1] bg-white text-[14px] text-ink ' +
  'placeholder:text-[#9aa8a0] outline-none transition-smooth hover:border-[#c8d4cd] ' +
  'focus:border-[#0f7f43] focus:shadow-[0_0_0_4px_rgba(15,127,67,0.12)]';

export function Field({ label, htmlFor, children }) {
  return (
    <div className="flex flex-col gap-1.5 text-left">
      <label htmlFor={htmlFor} className="text-[12.5px] font-semibold text-ink-body">
        {label}
      </label>
      {children}
    </div>
  );
}

// Text input with a leading icon. `trailing` renders inside the field on the
// right — used by the password show/hide toggle.
export function TextInput({ icon, trailing, ...props }) {
  return (
    <div className="relative flex items-center">
      <span className="pointer-events-none absolute left-[14px] z-10 flex items-center text-[#93a49b]">
        {icon}
      </span>
      <input
        {...props}
        className={`${INPUT_CLASS} pl-[42px] ${trailing ? 'pr-[42px]' : 'pr-[14px]'}`}
      />
      {trailing}
    </div>
  );
}

export function PasswordInput({ icon, ...props }) {
  const [show, setShow] = React.useState(false);
  const toggle = (
    <button
      type="button"
      onClick={() => setShow((s) => !s)}
      className="absolute right-[14px] flex items-center border-none bg-none p-0 text-[#93a49b] transition-fast hover:text-[#0f7f43]"
      aria-label={show ? 'Hide password' : 'Show password'}
    >
      {show ? <IconEyeOff size={17} /> : <IconEye size={17} />}
    </button>
  );
  return <TextInput icon={icon} trailing={toggle} type={show ? 'text' : 'password'} {...props} />;
}

export function Checkbox({ id, checked, onChange, children }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-2.5 text-[13px] text-ink-body">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="mt-[1px] h-[15px] w-[15px] flex-shrink-0 cursor-pointer rounded border-[#cfd9d3] accent-[#0f7f43]"
      />
      <span>{children}</span>
    </label>
  );
}

// Inline link-styled button. Used where the design shows a link but the target
// route does not exist yet (password reset, legal pages).
export function InlineAction({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-semibold text-[#0f7f43] transition-fast hover:text-[#0b5f32] hover:underline"
    >
      {children}
    </button>
  );
}

// Pill above the heading, e.g. "👋 Welcome back!".
export function Badge({ icon, children }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e7f4ec] px-3.5 py-1.5 text-[12.5px] font-semibold text-[#166b41]">
      {icon}
      {children}
    </span>
  );
}

const ALERT_STYLES = {
  error: 'bg-[#fdeeec] border-[#f5d7d2] text-[#a92e21]',
  success: 'bg-[#eaf6ef] border-[#cfe7d9] text-[#12673d]',
  info: 'bg-[#eef4fa] border-[#d5e3f0] text-[#2a5a86]',
};

export function Alert({ message }) {
  if (!message?.text) return null;
  const tone = ALERT_STYLES[message.type] || ALERT_STYLES.info;
  return (
    <div
      className={`mb-4 flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[13px] animate-slide-in-alert ${tone}`}
      role={message.type === 'error' ? 'alert' : 'status'}
    >
      <span className="mt-[1px] flex flex-shrink-0 items-center">
        <IconInfo size={15} />
      </span>
      <span className="text-left">{message.text}</span>
    </div>
  );
}

export function SubmitButton({ loading, icon, children }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="mt-1 flex h-[50px] w-full items-center justify-center gap-2.5 rounded-xl border-none bg-[#0f7f43] font-display text-[15px] font-bold text-white shadow-[0_10px_22px_-10px_rgba(15,127,67,0.65)] transition-smooth hover:enabled:bg-[#0c6a37] hover:enabled:shadow-[0_14px_28px_-10px_rgba(15,127,67,0.75)] active:enabled:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? (
        <span className="h-[18px] w-[18px] animate-spin-slow rounded-full border-2 border-white/40 border-t-white" />
      ) : (
        <>
          {icon}
          <span>{children}</span>
        </>
      )}
    </button>
  );
}

export function SecurityNote() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#dcebe2] bg-[#f0f8f3] px-4 py-3.5 text-left">
      <span className="mt-[1px] flex-shrink-0 text-[#0f7f43]">
        <IconShieldCheck size={17} />
      </span>
      <p className="text-[12.5px] leading-[1.6] text-[#5b6b62]">
        Your data is safe with us. We use industry-standard security to protect your information.
      </p>
    </div>
  );
}
