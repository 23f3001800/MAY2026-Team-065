// Printable report — the dashboard's charts, laid out for paper.
//
// "Save as PDF" is the browser's print dialog, not a client-side PDF library.
// jsPDF + html2canvas would add ~500KB to rasterise charts that are already
// vector SVG, and the result would be a blurry image of a chart rather than a
// crisp one. Print-to-PDF keeps the vectors, keeps text selectable, and costs
// nothing in bundle size.
//
// The trade-off is honest: the user goes through their browser's print sheet.
// That is one extra click for a much better artefact.
import React from 'react';
import { BarList, TrendLine, Donut } from '../charts';
import { IconDownload, IconX } from '../dashboard/icons';

function Section({ title, subtitle, children, breakBefore }) {
  return (
    <section className={`mb-7 ${breakBefore ? 'break-before-page' : ''} break-inside-avoid`}>
      <h2 className="font-display text-[15px] font-bold text-ink mb-0.5">{title}</h2>
      {subtitle && <p className="text-[11px] text-ink-muted mb-3">{subtitle}</p>}
      {children}
    </section>
  );
}

function Figure({ label, value, sub }) {
  return (
    <div className="border border-line rounded-lg px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wide text-ink-muted">{label}</div>
      <div className="font-display text-[22px] font-bold text-ink leading-none mt-1 tnum">{value}</div>
      {sub && <div className="text-[10px] text-ink-faint mt-1">{sub}</div>}
    </div>
  );
}

export default function PrintReport({ metrics, trend, categories, onClose }) {
  const now = new Date();

  return (
    <div className="fixed inset-0 z-[60] bg-ink/40 overflow-y-auto print:static print:bg-transparent print:overflow-visible">
      {/* Screen-only toolbar. Hidden on paper — a print-out should not carry
          buttons nobody can press. */}
      <div className="sticky top-0 z-10 bg-surface border-b border-line px-4 py-3 flex items-center justify-between gap-3 print:hidden">
        <div className="min-w-0">
          <h2 className="font-display text-[15px] font-bold text-ink">Report preview</h2>
          <p className="text-[12px] text-ink-muted">Print, or choose "Save as PDF" in the print dialog.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => window.print()}
            className="focus-ring inline-flex items-center gap-2 bg-civic-700 hover:bg-civic-800 text-white font-semibold text-[13px] px-4 py-2 rounded-lg transition-colors"
          >
            <IconDownload size={15} /> Print / Save as PDF
          </button>
          <button
            onClick={onClose}
            aria-label="Close"
            className="focus-ring w-9 h-9 rounded-lg text-ink-muted hover:bg-surface-inset flex items-center justify-center transition-colors"
          >
            <IconX size={18} />
          </button>
        </div>
      </div>

      {/* The sheet. Fixed max width so the layout on screen matches the page. */}
      <div className="mx-auto my-6 print:my-0 bg-surface shadow-xl print:shadow-none max-w-[820px] p-10 print:p-0">
        <header className="border-b-2 border-civic-800 pb-4 mb-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-[24px] font-bold text-civic-900 leading-tight">
                Civic Operations Report
              </h1>
              <p className="text-[12px] text-ink-muted mt-1">
                SmartCivicConnect · generated {now.toLocaleString(undefined, {
                  day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit',
                })}
              </p>
            </div>
            <div className="text-right text-[11px] text-ink-muted">
              <div className="font-semibold text-ink">{metrics.total} complaints</div>
              <div>on record</div>
            </div>
          </div>
        </header>

        <Section title="Summary">
          <div className="grid grid-cols-4 gap-3">
            <Figure label="Total" value={metrics.total} />
            <Figure label="Open" value={metrics.open} sub={`${metrics.untriaged} awaiting triage`} />
            <Figure label="Resolved" value={metrics.resolved} />
            <Figure
              label="Resolution rate"
              value={metrics.resolutionRate === null ? '—' : `${metrics.resolutionRate.toFixed(1)}%`}
              sub={metrics.resolutionRate === null ? 'no data' : `${metrics.resolved} of ${metrics.total}`}
            />
          </div>
        </Section>

        <Section title="Intake over time" subtitle={`Last 30 days · ${trend.counted} of ${trend.total} complaints fall in this window`}>
          <TrendLine points={trend.points} height={150} />
        </Section>

        <Section title="Status distribution">
          <Donut data={Object.entries(metrics.byStatus).sort((a, b) => b[1] - a[1]).slice(0, 6)} centerLabel="complaints" />
        </Section>

        <Section title="Categories" subtitle="Every configured category, including any with nothing reported" breakBefore>
          <BarList data={categories} total={metrics.total} />
        </Section>

        <Section title="Open complaints by age" subtitle="Open only — a closed complaint is not ageing">
          <BarList data={Object.entries(metrics.ageBuckets)} total={metrics.open} />
        </Section>

        <Section title="Departments">
          <BarList
            data={Object.entries(metrics.byDepartment).sort((a, b) => b[1] - a[1]).slice(0, 8)}
            total={metrics.total}
          />
        </Section>

        <footer className="border-t border-line pt-3 mt-8 text-[10px] text-ink-faint leading-relaxed">
          Figures are counted from the complaint record set returned by the API at the time of
          generation. Average resolution time is not included here: no resolution timestamp exists
          on a complaint, so it can only be produced by the on-demand resolution report, which
          reads each complaint's status history.
        </footer>
      </div>
    </div>
  );
}
