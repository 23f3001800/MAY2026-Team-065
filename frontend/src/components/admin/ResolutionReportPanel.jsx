// Generate a resolution-performance report.
//
// This is the one place average resolution time can be answered truthfully.
// The dashboards show "insufficient verified data" because their only timestamp
// is `updatedAt`, which moves on any edit. A report is on-demand, so it can
// afford the expensive-but-correct route: walk each complaint's status history
// and read the real transition into Resolved.
//
// Progress is genuine — one tick per completed request, not an animated bar —
// and the sample size, cap and unusable count are all stated. "Average over 50
// of 178" and "average over 178" are different claims.
import React, { useState } from 'react';
import Provenance from '../metrics/Provenance';
import { IconChart, IconRefresh, IconAlertTriangle, IconDownload } from '../dashboard/icons';
import { computeResolutionTimes, DEFAULT_SAMPLE_CAP } from '../../lib/resolutionReport';

function days(n) {
  if (n === null || n === undefined) return '—';
  if (n < 1) return `${Math.round(n * 24)}h`;
  return `${n.toFixed(1)} days`;
}

function Figure({ label, value, hint }) {
  return (
    <div className="bg-surface-inset rounded-lg px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</div>
      <div className="font-display text-[19px] font-bold text-ink mt-0.5 tnum">{value}</div>
      {hint && <div className="text-[10px] text-ink-faint mt-0.5">{hint}</div>}
    </div>
  );
}

export default function ResolutionReportPanel({ complaints = [] }) {
  const [report, setReport] = useState(null);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');

  const run = async () => {
    setError('');
    setReport(null);
    setProgress({ done: 0, total: 0 });
    try {
      const result = await computeResolutionTimes(complaints, {
        onProgress: (done, total) => setProgress({ done, total }),
      });
      setReport(result);
    } catch (err) {
      if (err.name !== 'SessionExpiredError') setError(err.message);
    } finally {
      setProgress(null);
    }
  };

  const download = () => {
    if (!report) return;
    const lines = [
      'Metric,Value',
      `Average resolution,${report.avgDays === null ? 'n/a' : report.avgDays.toFixed(2) + ' days'}`,
      `Median resolution,${report.medianDays === null ? 'n/a' : report.medianDays.toFixed(2) + ' days'}`,
      `Fastest,${report.fastest === null ? 'n/a' : report.fastest.toFixed(2) + ' days'}`,
      `Slowest,${report.slowest === null ? 'n/a' : report.slowest.toFixed(2) + ' days'}`,
      `Complaints sampled,${report.sampled}`,
      `Resolved complaints total,${report.eligible}`,
      `Sample capped,${report.capped ? 'yes (' + DEFAULT_SAMPLE_CAP + ')' : 'no'}`,
      `Histories unreadable,${report.unusable}`,
      `Generated,${new Date().toISOString()}`,
      'Source,GET /complaints/{id}/history — first transition into RESOLVED',
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resolution-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const pct = progress?.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <section className="bg-surface rounded-xl border border-line shadow-sm p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="w-9 h-9 rounded-xl bg-civic-50 text-civic-700 flex items-center justify-center shrink-0">
            <IconChart size={18} />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display text-[15px] font-bold text-ink">Resolution performance</h2>
              <Provenance level="verified">From status history</Provenance>
            </div>
            <p className="text-[13px] text-ink-muted mt-0.5 max-w-xl leading-snug">
              Reads each complaint's actual transition into Resolved. This is the figure the
              dashboards cannot show, because it needs one request per complaint.
            </p>
          </div>
        </div>
        <button
          onClick={run}
          disabled={Boolean(progress)}
          className="focus-ring lift shrink-0 inline-flex items-center gap-2 bg-civic-700 hover:bg-civic-800 disabled:opacity-60 text-white font-semibold text-[13px] px-3.5 py-2 rounded-lg transition-all"
        >
          <IconRefresh size={15} className={progress ? 'animate-spin-slow' : ''} />
          {progress ? 'Generating…' : report ? 'Regenerate' : 'Generate report'}
        </button>
      </div>

      {progress && (
        <div className="mt-4" role="status" aria-live="polite">
          <div className="flex items-center justify-between text-[11px] text-ink-muted mb-1">
            <span>Reading complaint histories…</span>
            <span className="tnum">{progress.done} / {progress.total}</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-inset overflow-hidden">
            <div className="h-full rounded-full bg-civic-600 transition-[width] duration-200" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="flex items-start gap-2 mt-4 text-[13px] text-danger-700 bg-danger-50 border border-danger-100 rounded-lg px-3 py-2">
          <IconAlertTriangle size={15} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}

      {report && (
        <div className="mt-4 animate-rise-in">
          {report.avgDays === null ? (
            <p className="text-[13px] text-ink-muted bg-surface-inset rounded-lg px-3 py-3">
              Insufficient verified data — none of the {report.sampled} sampled complaints has a
              readable transition into Resolved.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Figure label="Average" value={days(report.avgDays)} />
                <Figure label="Median" value={days(report.medianDays)} hint="less skewed by outliers" />
                <Figure label="Fastest" value={days(report.fastest)} />
                <Figure label="Slowest" value={days(report.slowest)} />
              </div>

              {/* State the sample honestly — a capped or partial sample is a
                  different claim from a complete one. */}
              <p className="text-[11px] text-ink-faint mt-3 leading-relaxed">
                Based on {report.sampled} of {report.eligible} resolved complaints
                {report.capped && ` (most recent ${DEFAULT_SAMPLE_CAP} sampled)`}
                {report.unusable > 0 && `; ${report.unusable} had no readable Resolved transition`}.
                Measured from report date to the first transition into Resolved.
              </p>

              <button
                onClick={download}
                className="focus-ring mt-3 inline-flex items-center gap-2 text-[12px] font-semibold text-civic-700 hover:underline"
              >
                <IconDownload size={14} /> Download as CSV
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
