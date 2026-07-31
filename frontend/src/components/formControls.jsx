// Small presentational building blocks shared by the auth forms.
import React from 'react';
import { IconInfo, IconEye, IconEyeOff, IconChevronRight } from './icons';

const INPUT_CLASS =
  'auth-input w-full bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.07)] rounded-xl py-3 text-[#f8fafc] font-primary text-[14px] outline-none transition-smooth focus:bg-[rgba(255,255,255,0.04)] focus:border-primary focus:shadow-input-focus';

export function FormField({ label, children }) {
  return (
    <div className="relative flex flex-col">
      <label className="text-[12px] font-semibold text-[#94a3b8] mb-1.5 text-left">{label}</label>
      {children}
    </div>
  );
}

// A labelled text input with a leading icon. `trailing` renders inside the
// input on the right (used for the password show/hide toggle).
export function TextInput({ icon, trailing, ...props }) {
  return (
    <div className="relative flex items-center">
      <span className="absolute left-[14px] text-[#64748b] flex items-center pointer-events-none z-10">
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
      className="absolute right-[14px] bg-none border-none text-[#64748b] cursor-pointer flex items-center p-0 transition-fast hover:text-[#f8fafc]"
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
      className="submit-btn-shimmer submit-gradient border-none rounded-xl py-[14px] text-white font-display text-[15px] font-bold cursor-pointer flex items-center justify-center gap-2 shadow-btn transition-smooth mt-[10px] relative overflow-hidden disabled:opacity-60 disabled:cursor-not-allowed hover:enabled:-translate-y-0.5 hover:enabled:shadow-btn-hover active:enabled:translate-y-0"
    >
      {loading ? (
        <span className="w-[18px] h-[18px] border-2 border-[rgba(255,255,255,0.3)] rounded-full border-t-white animate-spin-slow" />
      ) : (
        <>
          {children}
          <IconChevronRight />
        </>
      )}
    </button>
  );
}
