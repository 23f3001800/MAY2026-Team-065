// Operations Brief — what the numbers say, in sentences.
//
// IMPORTANT: these statements are RULE-DERIVED, not model-generated.
//
// The spec's architecture for an AI brief is
//   database -> analytics service -> verified metrics -> AI interpretation
// and the rule is that the model may interpret figures but never produce them.
// From the browser I cannot enforce that: I would be handing numbers to a model
// and rendering prose back, with no way to check it did not round, restate or
// invent one. A wrong number in a civic brief is worse than no brief.
//
// So every sentence here is computed by an explicit rule over the same metrics
// object the tiles use, and every numeric claim renders the counts it came
// from directly beneath it. When a real /analytics endpoint plus a server-side
// interpretation step exists, this component is the seam to swap.
import React from 'react';
import { Link } from 'react-router-dom';
import Provenance from './Provenance';
import { ranked } from '../../lib/complaintMetrics';
import { IconAlertTriangle, IconCheckCircle, IconClock, IconArrowRight } from '../dashboard/icons';

// Each rule returns null when it cannot speak to the data, rather than
// softening into a vague statement. Order is priority: what an officer should
// act on first comes first.
function buildInsights(m) {
  const out = [];
  if (!m || !m.total) return out;

  // 1. Untriaged backlog — the thing that stalls everything downstream.
  if (m.unassignedNew > 0) {
    const pct = (m.unassignedNew / m.total) * 100;
    out.push({
      tone: pct >= 25 ? 'caution' : 'neutral',
      icon: IconClock,
      text: `${m.unassignedNew} complaint${m.unassignedNew === 1 ? '' : 's'} ${m.unassignedNew === 1 ? 'is' : 'are'} still awaiting assignment — ${pct.toFixed(1)}% of the total record set.`,
      evidence: [
        ['Awaiting assignment', m.unassignedNew],
        ['Total complaints', m.total],
      ],
      action: { label: 'Review the queue', to: '/officer/complaints' },
    });
  }

  // 2. Ageing. Only meaningful if something is actually old.
  const stale = m.ageBuckets?.['30+ days'] || 0;
  if (stale > 0) {
    out.push({
      tone: 'caution',
      icon: IconAlertTriangle,
      text: `${stale} open complaint${stale === 1 ? '' : 's'} ${stale === 1 ? 'has' : 'have'} been open for more than 30 days${
        m.oldestOpenDays !== null ? `; the oldest is ${m.oldestOpenDays} days old` : ''
      }.`,
      evidence: [
        ['Open beyond 30 days', stale],
        ['Open complaints', m.open],
        ...(m.oldestOpenDays !== null ? [['Oldest open (days)', m.oldestOpenDays]] : []),
      ],
    });
  }

  // 3. Category concentration — only worth saying if one genuinely dominates.
  const cats = ranked(m.byCategory, 1);
  if (cats.top.length) {
    const [name, count] = cats.top[0];
    const share = (count / m.total) * 100;
    if (share >= 25) {
      out.push({
        tone: 'neutral',
        icon: IconCheckCircle,
        text: `${name} is the most frequently reported category, accounting for ${count} of ${m.total} complaints (${share.toFixed(1)}%).`,
        evidence: [
          [`${name} complaints`, count],
          ['Total complaints', m.total],
          ['Distinct categories', cats.totalKeys],
        ],
      });
    }
  }

  // 4. Severity pressure.
  if (m.criticalAndHigh > 0) {
    const pct = (m.criticalAndHigh / m.total) * 100;
    if (pct >= 20) {
      out.push({
        tone: 'critical',
        icon: IconAlertTriangle,
        text: `${m.criticalAndHigh} complaints are rated High or Critical — ${pct.toFixed(1)}% of the record set.`,
        evidence: [
          ['High severity', m.bySeverity?.High || 0],
          ['Critical severity', m.bySeverity?.Critical || 0],
          ['Total complaints', m.total],
        ],
      });
    }
  }

  // 5. Triage coverage — says how much of the AI picture is actually populated.
  if (m.triaged < m.total) {
    const missing = m.total - m.triaged;
    out.push({
      tone: 'neutral',
      icon: IconClock,
      text: `${missing} of ${m.total} complaints carry no AI triage, so category and severity on those are whatever was set at submission.`,
      evidence: [
        ['With AI triage', m.triaged],
        ['Total complaints', m.total],
      ],
    });
  }

  return out;
}

const TONE_STYLES = {
  neutral: 'border-line bg-surface',
  caution: 'border-caution-100 bg-caution-50/60',
  critical: 'border-danger-100 bg-danger-50/60',
};

const ICON_STYLES = {
  neutral: 'bg-leaf-50 text-leaf-700',
  caution: 'bg-caution-100 text-caution-700',
  critical: 'bg-danger-100 text-danger-700',
};

export default function OperationsBrief({ metrics, periodLabel }) {
  const insights = buildInsights(metrics);

  return (
    <section className="bg-surface rounded-xl border border-line shadow-sm overflow-hidden">
      <header className="flex items-start justify-between gap-3 px-5 py-4 border-b border-line bg-surface-inset">
        <div>
          <h2 className="font-display text-[16px] font-bold text-ink">Operations Brief</h2>
          <p className="text-[12px] text-ink-muted mt-0.5">
            {periodLabel || 'Across all complaints on record'}
          </p>
        </div>
        <Provenance level="derived">Rule-derived</Provenance>
      </header>

      {insights.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-[13px] text-ink-muted">
            {metrics?.total
              ? 'Nothing stands out in the current record set.'
              : 'Insufficient verified data to generate a brief.'}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {insights.map((insight, i) => {
            const Icon = insight.icon;
            return (
              <li
                key={i}
                style={{ '--i': i }}
                className={`px-5 py-4 animate-rise-in stagger border-l-2 ${TONE_STYLES[insight.tone]}`}
              >
                <div className="flex items-start gap-3">
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${ICON_STYLES[insight.tone]}`}>
                    <Icon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] text-ink-body leading-relaxed">{insight.text}</p>

                    {/* Every numeric claim shows the counts behind it. This is
                        the difference between a brief and an assertion. */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                      {insight.evidence.map(([label, value]) => (
                        <span key={label} className="text-[11px] text-ink-muted">
                          {label}
                          <span className="ml-1 font-mono font-medium text-ink tnum">{value}</span>
                        </span>
                      ))}
                    </div>

                    {insight.action && (
                      <Link
                        to={insight.action.to}
                        className="inline-flex items-center gap-1 text-[12px] font-semibold text-leaf-700 hover:underline mt-2"
                      >
                        {insight.action.label} <IconArrowRight size={13} />
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <footer className="px-5 py-2.5 border-t border-line bg-surface-inset">
        <p className="text-[11px] text-ink-faint leading-snug">
          Statements are computed from the complaint record set, not generated by a language model.
          Figures shown beneath each line are the counts they were derived from.
        </p>
      </footer>
    </section>
  );
}
