// One shape for every admin form.
//
// The forms had drifted: some used labels, some relied on placeholders alone,
// and the two that mattered most — department and designation — were free text,
// so an officer could be filed under "roads" or "Roads and Transport" or a typo,
// none of which match the department a complaint is routed to.
//
// A placeholder is not a label. It disappears the moment someone types, so a
// half-completed form stops explaining itself, and screen readers treat it as a
// hint rather than a name. Every field here is labelled, and anything with a
// known set of valid answers is a select rather than a text box.
import React from 'react';
import { IconChevronDown, IconAlertTriangle } from '../dashboard/icons';

const CONTROL =
  'w-full bg-surface rounded-lg border border-line px-3 py-2.5 text-[13.5px] text-ink '
  + 'outline-none transition-all placeholder:text-ink-faint '
  + 'focus:border-leaf-500 focus:ring-2 focus:ring-leaf-500/15 '
  + 'disabled:bg-surface-inset disabled:text-ink-muted disabled:cursor-not-allowed';

const LABEL = 'block text-[11px] font-semibold uppercase tracking-wide text-ink-muted mb-1.5';

export function Field({ id, label, hint, required = false, children }) {
  return (
    <div>
      <label className={LABEL} htmlFor={id}>
        {label}
        {required && <span className="text-danger-600 ml-1" aria-hidden="true">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11.5px] text-ink-faint mt-1.5 leading-snug">{hint}</p>}
    </div>
  );
}

export function TextField({ id, label, hint, required, ...props }) {
  return (
    <Field id={id} label={label} hint={hint} required={required}>
      <input id={id} className={CONTROL} required={required} {...props} />
    </Field>
  );
}

/**
 * A select with a real empty option.
 *
 * `placeholder` is the text shown while nothing is chosen. It stays selectable
 * unless the field is required, so a value can be cleared again — a dropdown
 * you cannot un-choose is a trap when someone picks the wrong row.
 */
export function SelectField({
  id, label, hint, required, options = [], placeholder = 'Choose…', value, onChange, ...props
}) {
  return (
    <Field id={id} label={label} hint={hint} required={required}>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={onChange}
          required={required}
          className={`${CONTROL} appearance-none pr-9 cursor-pointer`}
          {...props}
        >
          <option value="">{placeholder}</option>
          {options.map((o) => {
            const val = typeof o === 'string' ? o : o.value;
            const text = typeof o === 'string' ? o : o.label;
            return <option key={val} value={val}>{text}</option>;
          })}
          {/* A stored value that is no longer in the list still has to be
              selectable, or opening the form would silently change it. */}
          {value && !options.some((o) => (typeof o === 'string' ? o : o.value) === value) && (
            <option value={value}>{value}</option>
          )}
        </select>
        <IconChevronDown
          size={16}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none"
        />
      </div>
    </Field>
  );
}

export function FormError({ children }) {
  if (!children) return null;
  return (
    <p role="alert" className="flex items-start gap-2 text-[13px] font-medium text-danger-700 bg-danger-50 border border-danger-100 rounded-lg px-3 py-2">
      <IconAlertTriangle size={14} className="shrink-0 mt-0.5" />
      <span>{children}</span>
    </p>
  );
}

export function SubmitRow({ busy, label, busyLabel, onCancel }) {
  return (
    <div className="flex gap-2 pt-1">
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="focus-ring flex-1 bg-surface border border-line hover:bg-surface-inset text-ink-body font-semibold text-[13.5px] py-2.5 rounded-lg transition-colors"
        >
          Cancel
        </button>
      )}
      <button
        type="submit"
        disabled={busy}
        className="focus-ring flex-1 inline-flex items-center justify-center gap-2 bg-leaf-600 hover:enabled:bg-leaf-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-[13.5px] py-2.5 rounded-lg shadow-sm transition-all"
      >
        {busy ? busyLabel || 'Saving…' : label}
      </button>
    </div>
  );
}

// The designations the department actually uses. A free-text box here produced
// "Sr. Officer", "Senior officer" and "SO" for the same job.
export const DESIGNATIONS = [
  'Grievance Officer',
  'Senior Grievance Officer',
  'Ward Officer',
  'Assistant Engineer',
  'Executive Engineer',
  'Department Head',
];
