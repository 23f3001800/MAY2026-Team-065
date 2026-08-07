// The citizen's acknowledgement slip for a filed complaint.
//
// Shape verified against the running backend rather than openapi.yaml, which
// types this response as an untyped {}:
//   { reportTitle, generatedAt, complaintId, status, severity, description,
//     submittedAt, lastUpdatedAt,
//     category: { name, department },
//     location: { address, latitude, longitude },
//     citizenDetails: { name, email, phone },
//     assignmentDetails: { assignedWorker, overseeingOfficer },
//     aiAssessment: { severity, summary, source, analysedAt } }
//
// Every nested block is rendered defensively: aiAssessment comes back with all
// nulls on a complaint that predates triage, and assignmentDetails reads
// "Unassigned" rather than being absent.
import React, { useEffect, useState } from 'react';
import { IconX, IconCheckCircle, IconAlertTriangle } from './icons';
import { getReportSlip } from '../../api/complaints';
import { fromApiStatus, fromApiSeverity } from '../../api/mappers';

function stamp(iso) {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function Line({ label, value }) {
  return (
    <div className="flex items-baseline gap-3 py-1.5">
      <span className="text-[11px] uppercase tracking-wide text-ink-faint w-[104px] shrink-0">{label}</span>
      <span className="text-[13px] text-ink-body min-w-0">{value || '—'}</span>
    </div>
  );
}

function Block({ title, children }) {
  return (
    <section className="border-t border-slate-100 pt-3">
      <h3 className="text-[12px] font-semibold text-ink mb-1">{title}</h3>
      {children}
    </section>
  );
}

export default function ReportSlipModal({ complaintId, onDismiss }) {
  const [slip, setSlip] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onDismiss();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDismiss]);

  useEffect(() => {
    let alive = true;
    getReportSlip(complaintId)
      .then((d) => alive && setSlip(d))
      .catch((err) => {
        if (alive && err.name !== 'SessionExpiredError') setError(err.message);
      });
    return () => { alive = false; };
  }, [complaintId]);

  const ai = slip?.aiAssessment;
  const hasAi = ai && (ai.severity || ai.summary);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 animate-overlay-in" onClick={onDismiss} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Complaint acknowledgement slip"
        className="relative w-full max-w-[520px] bg-white rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto animate-scale-in"
      >
        <div className="sticky top-0 bg-white border-b border-line px-5 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-lg bg-emerald-50 text-primary flex items-center justify-center shrink-0">
              <IconCheckCircle size={17} />
            </span>
            <h2 className="font-display font-bold text-ink text-[16px] truncate">
              {slip?.reportTitle || 'Acknowledgement Slip'}
            </h2>
          </div>
          <button
            onClick={onDismiss}
            aria-label="Close"
            className="focus-ring shrink-0 w-8 h-8 rounded-lg text-ink-faint hover:bg-slate-100 hover:text-ink-body flex items-center justify-center transition-colors"
          >
            <IconX size={17} />
          </button>
        </div>

        <div className="px-5 py-4">
          {error ? (
            <p className="flex items-start gap-2 text-[13px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <IconAlertTriangle size={15} className="mt-0.5 shrink-0" /> {error}
            </p>
          ) : !slip ? (
            <div className="space-y-2" aria-label="Loading slip">
              {[...Array(6)].map((_, i) => <div key={i} className="skeleton animate-shimmer h-3" />)}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-slate-50 rounded-xl px-3.5 py-3">
                <div className="text-[11px] uppercase tracking-wide text-ink-faint">Complaint ID</div>
                <div className="font-mono font-semibold text-ink text-[15px]">{slip.complaintId}</div>
                <div className="text-[11px] text-ink-faint mt-1">Generated {stamp(slip.generatedAt)}</div>
              </div>

              <Block title="Complaint">
                <Line label="Status" value={fromApiStatus(slip.status)} />
                <Line label="Severity" value={fromApiSeverity(slip.severity)} />
                <Line label="Category" value={slip.category?.name} />
                <Line label="Department" value={slip.category?.department} />
                <Line label="Submitted" value={stamp(slip.submittedAt)} />
                <Line label="Updated" value={stamp(slip.lastUpdatedAt)} />
                <Line label="Description" value={slip.description} />
              </Block>

              <Block title="Location">
                <Line label="Address" value={slip.location?.address} />
                {typeof slip.location?.latitude === 'number' && (
                  <Line
                    label="Coordinates"
                    value={`${slip.location.latitude.toFixed(5)}, ${slip.location.longitude.toFixed(5)}`}
                  />
                )}
              </Block>

              <Block title="Reported by">
                <Line label="Name" value={slip.citizenDetails?.name} />
                <Line label="Email" value={slip.citizenDetails?.email} />
                <Line label="Phone" value={slip.citizenDetails?.phone} />
              </Block>

              <Block title="Handling">
                <Line label="Field worker" value={slip.assignmentDetails?.assignedWorker} />
                <Line label="Officer" value={slip.assignmentDetails?.overseeingOfficer} />
              </Block>

              {hasAi && (
                <Block title="AI assessment">
                  <Line label="Severity" value={ai.severity ? fromApiSeverity(ai.severity) : null} />
                  <Line label="Summary" value={ai.summary} />
                  <Line label="Source" value={ai.source === 'rules' ? 'Rules engine' : ai.source} />
                  <Line label="Analysed" value={stamp(ai.analysedAt)} />
                </Block>
              )}

              <p className="text-[11px] text-ink-faint border-t border-slate-100 pt-3">
                Keep this reference for any follow-up about the complaint.
              </p>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-line px-5 py-3 flex justify-end gap-2">
          {/* Browser print is the whole feature: the backend returns JSON, not a
              PDF, so generating one client-side would be a lot of bundle for
              something the print dialog already does. */}
          <button
            onClick={() => window.print()}
            disabled={!slip}
            className="focus-ring text-[13px] font-semibold text-ink-body bg-slate-100 hover:bg-slate-200 disabled:opacity-50 px-3.5 py-2 rounded-lg transition"
          >
            Print
          </button>
          <button
            onClick={onDismiss}
            className="focus-ring text-[13px] font-semibold text-white bg-primary hover:bg-emerald-600 px-3.5 py-2 rounded-lg transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
