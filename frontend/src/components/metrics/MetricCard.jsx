// A single operations metric.
//
// Every number carries three things beyond its value: what it is, where it came
// from, and how it was worked out. The third is the one dashboards usually skip
// — and it is the one an officer needs when a figure looks wrong and they have
// to decide whether to trust it or escalate it.
//
// `formula` is shown on demand rather than always: it is reassurance, not
// primary content, and printing arithmetic beside every tile would bury the
// numbers it is meant to support.
import React, { useState } from 'react';
import Provenance from './Provenance';
import useCountUp from '../../hooks/useCountUp';
import { IconChevronDown } from '../dashboard/icons';

const TONES = {
  neutral: { accent: 'bg-civic-600', tint: 'text-civic-700' },
  positive: { accent: 'bg-teal-600', tint: 'text-teal-700' },
  caution: { accent: 'bg-caution-500', tint: 'text-caution-700' },
  critical: { accent: 'bg-danger-600', tint: 'text-danger-700' },
};

/**
 * @param {string} label
 * @param {number|null} value      null renders the insufficient-data state
 * @param {string} [unit]          e.g. '%' — kept out of the count-up
 * @param {string} [context]       the fraction behind the number, e.g. '178 / 247'
 * @param {string} [formula]       shown under "How is this calculated?"
 * @param {'verified'|'derived'|'insufficient'} [provenance]
 * @param {string} [footnote]      e.g. what it was counted from, or as-of time
 * @param {Function} [onClick]     makes the whole tile a filter action
 */
export default function MetricCard({
  label, value, unit = '', context, formula,
  provenance = 'derived', tone = 'neutral', footnote, onClick,
}) {
  const [showFormula, setShowFormula] = useState(false);
  const numeric = typeof value === 'number' && Number.isFinite(value);
  const shown = useCountUp(numeric ? value : 0);
  const { accent, tint } = TONES[tone] || TONES.neutral;

  const interactive = typeof onClick === 'function' && numeric;
  const Tag = interactive ? 'button' : 'div';

  return (
    <div className="relative bg-surface rounded-xl border border-line shadow-sm overflow-hidden">
      {/* A thin accent rule rather than a coloured card: it carries the
          semantic without tinting the whole tile, so a row of metrics still
          reads as one family. */}
      <span className={`absolute inset-x-0 top-0 h-[3px] ${accent}`} aria-hidden="true" />

      <Tag
        onClick={onClick}
        className={`block w-full text-left p-4 pt-5 ${
          interactive ? 'focus-ring hover:bg-surface-inset transition-colors cursor-pointer' : ''
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
            {label}
          </span>
          <Provenance level={numeric ? provenance : 'insufficient'} />
        </div>

        {numeric ? (
          <>
            <div className="mt-2.5 flex items-baseline gap-1">
              <span className="font-display text-[30px] font-bold text-ink leading-none tnum">
                {shown.toLocaleString()}
              </span>
              {unit && <span className={`text-[16px] font-semibold ${tint}`}>{unit}</span>}
            </div>
            {context && (
              <div className="mt-1 text-[12px] text-ink-muted tnum">{context}</div>
            )}
          </>
        ) : (
          <div className="mt-2.5">
            <div className="font-display text-[20px] font-semibold text-ink-faint leading-none">—</div>
            <p className="text-[12px] text-ink-muted mt-1.5 leading-snug">
              Insufficient verified data for this metric.
            </p>
          </div>
        )}

        {footnote && (
          <div className="mt-2 text-[11px] text-ink-faint leading-snug">{footnote}</div>
        )}
      </Tag>

      {formula && numeric && (
        <div className="border-t border-line">
          <button
            onClick={() => setShowFormula((v) => !v)}
            aria-expanded={showFormula}
            className="focus-ring w-full flex items-center justify-between gap-2 px-4 py-2 text-[11px] font-medium text-ink-muted hover:bg-surface-inset transition-colors"
          >
            How is this calculated?
            <IconChevronDown
              size={13}
              className={`transition-transform duration-200 ${showFormula ? 'rotate-180' : ''}`}
            />
          </button>
          {showFormula && (
            <div className="px-4 pb-3 animate-rise-in">
              <code className="block text-[11px] font-mono text-ink-body bg-surface-inset border border-line rounded-md px-2.5 py-2 leading-relaxed">
                {formula}
              </code>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
