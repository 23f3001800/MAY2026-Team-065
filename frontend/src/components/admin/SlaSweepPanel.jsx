// SLA breach sweep.
//
// Covers "alert officers when complaints breach expected resolution timelines".
//
// The note at the bottom used to say flatly that nothing schedules this. That
// stopped being true: SLA_ENABLED defaults to on and the API starts a sweeper
// task at boot, so on a normal deployment breaches ARE found without anybody
// pressing anything. Telling an admin otherwise sends them looking for a
// problem they do not have.
//
// It is still worth saying when the sweeper is off or has died, so the note now
// asks GET /health/ready instead of asserting. Same shared answer the health
// panel uses, so mounting both is one request.
//
// Response shape verified against the running backend (openapi types it as an
// untyped {}):
//   { message, breached, notified, targetsHours: { CRITICAL, HIGH, MEDIUM, LOW } }
import React, { useState } from 'react';
import { IconClock, IconCheckCircle, IconAlertTriangle, IconRefresh } from '../dashboard/icons';
import { runSlaSweep } from '../../api/admin';
import useReadiness from '../../hooks/useReadiness';

// Order matters: most urgent first, matching how severity reads everywhere else.
const SEVERITY_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

const TONE = {
  CRITICAL: 'bg-red-50 text-red-700',
  HIGH: 'bg-orange-50 text-orange-800',
  MEDIUM: 'bg-amber-50 text-amber-800',
  LOW: 'bg-emerald-50 text-emerald-700',
};

function formatHours(h) {
  if (typeof h !== 'number') return '—';
  if (h < 24) return `${h}h`;
  const days = h / 24;
  return Number.isInteger(days) ? `${days}d` : `${h}h`;
}

export default function SlaSweepPanel() {
  const { readiness } = useReadiness();
  const sweeper = readiness?.checks?.slaSweeper;
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);

  const sweep = async () => {
    setRunning(true);
    setError('');
    try {
      setResult(await runSlaSweep());
    } catch (err) {
      if (err.name !== 'SessionExpiredError') setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  const targets = result?.targetsHours;

  return (
    <section className="bg-white rounded-2xl border border-line shadow-sm p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <IconClock size={18} />
          </span>
          <div className="min-w-0">
            <h2 className="font-semibold text-ink text-[15px]">Resolution timeline check</h2>
            <p className="text-[13px] text-ink-muted mt-0.5 max-w-lg leading-snug">
              Finds complaints past their expected resolution window and notifies the officers
              responsible.
            </p>
          </div>
        </div>
        <button
          onClick={sweep}
          disabled={running}
          className="focus-ring lift shrink-0 inline-flex items-center gap-2 bg-primary hover:bg-leaf-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-[13px] px-3.5 py-2 rounded-lg shadow-btn transition-all"
        >
          <IconRefresh size={15} className={running ? 'animate-spin-slow' : ''} />
          {running ? 'Checking…' : 'Run check'}
        </button>
      </div>

      {error && (
        <p role="alert" className="flex items-start gap-2 mt-3 text-[13px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <IconAlertTriangle size={15} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}

      {result && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2 text-[13px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            <IconCheckCircle size={15} className="shrink-0" />
            <span>
              {result.breached === 0
                ? 'Nothing has breached its target.'
                : `${result.breached} complaint${result.breached === 1 ? '' : 's'} past target — ${result.notified} notification${result.notified === 1 ? '' : 's'} sent.`}
            </span>
          </div>

          {targets && (
            <div>
              <div className="text-[11px] uppercase tracking-wide text-ink-faint mb-1.5">
                Targets by severity
              </div>
              <div className="flex flex-wrap gap-2">
                {SEVERITY_ORDER.filter((k) => k in targets).map((k) => (
                  <span
                    key={k}
                    className={`inline-flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1 rounded-lg ${TONE[k] || 'bg-slate-100 text-slate-700'}`}
                  >
                    {k.charAt(0) + k.slice(1).toLowerCase()}
                    <span className="opacity-70 tnum">{formatHours(targets[k])}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <p className="text-[11px] text-ink-faint mt-4 pt-3 border-t border-slate-100">
        {sweeper?.enabled && sweeper?.running
          ? 'A background sweeper is also running, so breaches are found without this button. '
            + 'Pressing it just checks now rather than waiting for the next pass.'
          : sweeper && !sweeper.enabled
            ? 'The background sweeper is switched off on this deployment, so breaches are only '
              + 'found when you press this button.'
            : sweeper
              ? 'The background sweeper is enabled but is not running — until it is restarted, '
                + 'breaches are only found when you press this button.'
              : 'If the background sweeper is not running, breaches go unnoticed between runs. '
                + 'System health on the dashboard says which.'}
      </p>
    </section>
  );
}
