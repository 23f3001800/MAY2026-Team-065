// What is actually working, from GET /health/ready.
//
// Mail is deliberately first and loudest. While `checks.mail.configured` is
// false — which it is today — no credential email and no password reset code is
// reaching anybody. That does not break a screen, so nothing else on the admin
// dashboard would ever mention it, and the symptom surfaces days later as a new
// hire who cannot sign in and a citizen who never got their code. The two
// features that depend on it are the ones an administrator has just been given.
//
// The other checks are reported as degradation rather than failure, because
// that is what they are: an unavailable model still leaves the deterministic
// triage engine running, and an empty analytics cache is a cold start, not a
// fault. Only the database is a hard dependency.
import React from 'react';
import { IconHourglass, IconAlertTriangle, IconRefresh } from '../dashboard/icons';
import useReadiness from '../../hooks/useReadiness';

function Row({ ok, label, value, detail, tone }) {
  const dot = tone || (ok ? 'bg-emerald-500' : 'bg-amber-500');
  return (
    <li className="flex items-start gap-2.5 py-2">
      <span className={`mt-[6px] h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[13px] font-medium text-ink">{label}</span>
          <span className="shrink-0 text-[12.5px] text-ink-muted">{value}</span>
        </div>
        {detail && <p className="mt-0.5 text-[11.5px] leading-snug text-ink-faint">{detail}</p>}
      </div>
    </li>
  );
}

export default function SystemHealthPanel() {
  const { readiness, error, loading, refresh } = useReadiness();

  const checks = readiness?.checks || {};
  const { database, ai, mail, slaSweeper, cache } = checks;
  const degraded = readiness?.status === 'degraded';

  const hitRate = typeof cache?.hitRate === 'number'
    ? `${Math.round(cache.hitRate * 100)}%`
    : null;

  return (
    <section className="bg-surface rounded-xl border border-line shadow-sm p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="w-9 h-9 rounded-xl bg-civic-50 text-civic-700 flex items-center justify-center shrink-0">
            <IconHourglass size={18} />
          </span>
          <div className="min-w-0">
            <h2 className="font-semibold text-ink text-[15px]">System health</h2>
            <p className="text-[13px] text-ink-muted mt-0.5 leading-snug">
              What is working, and what is quietly not.
            </p>
          </div>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          aria-label="Refresh system health"
          className="focus-ring shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12.5px] font-semibold text-ink-body transition-colors hover:bg-surface-inset disabled:opacity-50"
        >
          <IconRefresh size={14} className={loading ? 'animate-spin-slow' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg border border-danger-100 bg-danger-50 px-3 py-2 text-[13px] text-danger-700">
          <IconAlertTriangle size={15} className="mt-0.5 shrink-0" />
          {/* Not "degraded" — a 503 still answers. Reaching here means nothing
              answered at all. */}
          The API did not respond, so nothing here can be checked. {error}
        </p>
      )}

      {!error && loading && !readiness && (
        <p className="mt-3 text-[13px] text-ink-faint">Checking…</p>
      )}

      {!error && readiness && (
        <>
          {/* ── Mail, first and on its own ─────────────────────── */}
          {mail && !mail.configured && (
            <div
              role="alert"
              className="mt-3 rounded-lg border border-caution-100 bg-caution-50 px-3 py-2.5"
            >
              <div className="flex items-start gap-2">
                <IconAlertTriangle size={15} className="mt-0.5 shrink-0 text-caution-700" />
                <div className="min-w-0 text-[12.5px] leading-snug text-ink-body">
                  <p className="font-semibold text-caution-700">
                    No mail server is configured — no email is leaving this system.
                  </p>
                  <p className="mt-1">
                    New accounts are created without their holder ever being told the
                    password, and anyone using “Forgot password” gets a code that is never
                    sent. Both flows report success, because the accounts and codes are
                    real; only the delivery is missing.
                  </p>
                  <p className="mt-1 text-ink-muted">
                    Until SMTP is set up, pass new credentials on yourself and reset
                    forgotten passwords from the user list.
                  </p>
                </div>
              </div>
            </div>
          )}

          {degraded && (
            <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg border border-danger-100 bg-danger-50 px-3 py-2 text-[13px] text-danger-700">
              <IconAlertTriangle size={15} className="mt-0.5 shrink-0" />
              The database is unreachable. Nothing that reads or writes a complaint will
              work until it comes back.
            </p>
          )}

          <ul className="mt-3 divide-y divide-line">
            <Row
              ok={database?.ok}
              label="Database"
              value={database?.ok ? 'Connected' : 'Unreachable'}
              tone={database?.ok ? undefined : 'bg-danger-600'}
              detail={database?.ok ? null : database?.error}
            />
            <Row
              ok={Boolean(mail?.configured)}
              label="Email delivery"
              value={mail?.configured ? (mail.host || 'Configured') : 'Not configured'}
              detail={mail?.configured ? null : 'Credential and reset emails are not being sent.'}
            />
            <Row
              ok={ai?.ok}
              label="AI triage"
              value={
                ai?.ok
                  ? `${ai.provider || 'unknown'}${ai.llmAvailable ? '' : ' (rules only)'}`
                  : 'Unavailable'
              }
              detail={
                ai?.ok && ai.llmAvailable
                  ? null
                  : 'The deterministic engine still classifies every complaint, so triage continues.'
              }
            />
            <Row
              ok={Boolean(slaSweeper?.enabled && slaSweeper?.running)}
              label="Deadline sweeper"
              value={
                !slaSweeper?.enabled ? 'Disabled'
                  : slaSweeper?.running ? 'Running' : 'Stopped'
              }
              detail={
                slaSweeper?.enabled && slaSweeper?.running
                  ? 'Breaches are found automatically; the manual check on Reports is not required.'
                  : 'Breaches are only found when somebody runs the check on Reports.'
              }
            />
            <Row
              ok
              label="Analytics cache"
              value={hitRate ? `${hitRate} hit rate` : 'No requests yet'}
              detail={
                hitRate
                  ? `${cache.entries} entr${cache.entries === 1 ? 'y' : 'ies'} held, ${cache.hits} served from cache.`
                  : 'Nothing has been asked of it since the last restart.'
              }
            />
          </ul>
        </>
      )}
    </section>
  );
}
