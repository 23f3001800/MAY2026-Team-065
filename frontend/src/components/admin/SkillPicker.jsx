// Pick a field worker's skills from the departments that actually exist.
//
// A dropdown rather than a text box, because the value is not free text in
// practice: assignment substring-matches it against a complaint's department,
// so anything not spelled like a real department is dead weight. Typing
// "Roads" instead of "Roads & Transport" produced a worker who never surfaced
// as a candidate, with nothing on screen to explain why.
//
// Multi-select, because a worker usually covers more than one department, and
// the backend stores the whole set as one comma-separated string.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { IconChevronDown, IconX, IconCheckCircle, IconAlertTriangle } from '../dashboard/icons';
import useCategories from '../../hooks/useCategories';
import { skillOptions, unmatchedSkills } from '../../lib/skills';

/**
 * @param {string[]} value      currently selected skills
 * @param {Function} onChange   called with the new array
 * @param {boolean} [disabled]
 */
export default function SkillPicker({ value = [], onChange, disabled = false }) {
  const { categories } = useCategories();
  const options = useMemo(() => skillOptions(categories), [categories]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // Skills stored before this picker existed may not match any department.
  // They are kept and flagged rather than dropped — losing an admin's data
  // silently to make a form tidy is not a trade worth making.
  const stray = useMemo(() => unmatchedSkills(value, options), [value, options]);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const toggle = (skill) => {
    onChange(value.includes(skill) ? value.filter((s) => s !== skill) : [...value, skill]);
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="focus-ring w-full flex items-center justify-between gap-2 bg-white rounded-lg border border-slate-200 px-3 py-2 text-left disabled:opacity-60 disabled:cursor-not-allowed hover:border-slate-300 transition-colors"
      >
        <span className="text-[13px] text-slate-800 truncate">
          {value.length === 0
            ? <span className="text-slate-400">Choose the departments this worker covers…</span>
            : `${value.length} selected`}
        </span>
        <IconChevronDown
          size={16}
          className={`text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* The selection, always visible. A count alone means an admin has to
          reopen the menu to check what they picked. */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {value.map((s) => {
            const isStray = stray.includes(s);
            return (
              <span
                key={s}
                className={`inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md text-[11.5px] font-medium ${
                  isStray ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700'
                }`}
              >
                {isStray && <IconAlertTriangle size={11} />}
                {s}
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => toggle(s)}
                    aria-label={`Remove ${s}`}
                    className="focus-ring rounded p-0.5 hover:bg-black/5"
                  >
                    <IconX size={11} />
                  </button>
                )}
              </span>
            );
          })}
        </div>
      )}

      {stray.length > 0 && (
        <p className="flex items-start gap-1.5 text-[11px] text-amber-700 mt-1.5 leading-snug">
          <IconAlertTriangle size={12} className="shrink-0 mt-0.5" />
          <span>
            {stray.length === 1 ? 'This skill does not' : 'These skills do not'} match any
            department, so {stray.length === 1 ? 'it' : 'they'} will never bring this worker up as
            a candidate for assignment.
          </span>
        </p>
      )}

      {open && (
        <ul
          role="listbox"
          aria-multiselectable="true"
          className="absolute z-30 mt-1 w-full max-h-56 overflow-y-auto bg-white rounded-lg border border-slate-200 shadow-lg py-1"
        >
          {options.length === 0 ? (
            <li className="px-3 py-2 text-[12.5px] text-slate-500">
              No departments are configured, so there is nothing to pick from.
            </li>
          ) : options.map((s) => {
            const selected = value.includes(s);
            return (
              <li key={s}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => toggle(s)}
                  className="focus-ring w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  {s}
                  {selected && <IconCheckCircle size={14} className="text-emerald-600 shrink-0" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
