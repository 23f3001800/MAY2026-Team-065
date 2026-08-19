// Small presentational building blocks shared by the auth forms.
//
// Styled from the design tokens rather than hardcoded dark values. The auth
// pages used to be the only dark surface in the product, so signing in changed
// the app's character halfway through; these now sit on the same warm pape
// ground as everything behind the login.
import React from 'react';
import { IconInfo, IconEye, IconEyeOff, IconChevronRight } from './icons';

const INPUT_CLASS =
  'w-full bg-surface border border-line rounded-xl py-3 text-ink font-primary text-[14px] '
  + 'outline-none transition-all placeholder:text-ink-faint '
  + 'focus:border-civic-500 focus:ring-2 focus:ring-civic-500/15';

export function FormField({ label, children }) {
  return (
    <div className="relative flex flex-col">
      <label className="text-[12px] font-semibold uppercase tracking-wide text-ink-muted mb-1.5 text-left">
        {label}
      </label>
      {children}
    </div>
  );
}

// A labelled text input with a leading icon. `trailing` renders inside the
// input on the right (used for the password show/hide toggle).
export function TextInput({ icon, trailing, ...props }) {
  return (
    <div className="relative flex items-center">
      <span className="absolute left-[14px] text-ink-faint flex items-center pointer-events-none z-10">
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

// A password input that manages its own show/hide state.
export function PasswordInput({ icon, value, onChange, placeholder, ...props }) {
  const [show, setShow] = React.useState(false);
  const toggle = (
    <button
      type="button"
      onClick={() => setShow((s) => !s)}
      className="focus-ring absolute right-[14px] rounded bg-none border-none text-ink-faint cursor-pointer flex items-center p-0 transition-colors hover:text-ink"
      aria-label={show ? 'Hide password' : 'Show password'}
    >
      {show ? <IconEyeOff /> : <IconEye />}
    </button>
  );
  return (
    <TextInput
      icon={icon}
      trailing={toggle}
      type={show ? 'text' : 'password'}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      {...props}
    />
  );
}

// Inline alert banner for success / error messages.
export function Alert({ message }) {
  if (!message?.text) return null;
  const isError = message.type === 'error';
  return (
    <div
      className={`flex items-center gap-3 px-4 py-[14px] rounded-xl mb-5 text-[13px] animate-slide-in-alert border ${
        isError
          ? 'bg-[rgba(239,68,68,0.1)] border-[rgba(239,68,68,0.2)] text-[#fca5a5]'
          : 'bg-[rgba(16,185,129,0.1)] border-[rgba(16,185,129,0.2)] text-[#a7f3d0]'
      }`}
    >
      <span className="flex-shrink-0 flex items-center"><IconInfo /></span>
      <span>{message.text}</span>
    </div>
  );
}

// Primary gradient submit button with loading spinner.
export function SubmitButton({ loading, children }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="focus-ring w-full bg-civic-800 hover:enabled:bg-civic-900 border-none rounded-xl py-[13px] text-white font-display text-[15px] font-bold cursor-pointer flex items-center justify-center gap-2 shadow-md transition-all mt-2 disabled:opacity-60 disabled:cursor-not-allowed hover:enabled:-translate-y-0.5 active:enabled:translate-y-0"
    >
      {loading ? (
        <span className="w-[18px] h-[18px] border-2 border-white/30 rounded-full border-t-white animate-spin-slow" />
      ) : (
        <>
          {children}
          <IconChevronRight />
        </>
      )}
    </button>
  );
}
