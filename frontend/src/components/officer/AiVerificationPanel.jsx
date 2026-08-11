// AI assistance for verifying completion evidence.
//
// The question an officer is actually answering is "does the reported problem
// still appear in the after photo?" — so that is what this asks. It re-runs
// vision (POST /ai/analyze-image) on the completion photo and compares what the
// model sees NOW against what the complaint says the problem was.
//
// A raw before/after similarity score cannot answer that, which is worth being
// explicit about because it is the obvious thing to reach for:
//
//   very similar   -> nothing changed (not fixed)  OR  same angle, small fix
//   very different -> problem gone (fixed)         OR  a photo of somewhere else
//
// Both ends are ambiguous. The number is shown as a supporting signal, computed
// in the browser (the backend has no image-comparison endpoint), and clearly
// labelled as not being the verdict.
//
// EVERYTHING HERE IS A RECOMMENDATION. It never changes a status. The officer
// decides, and the panel says so.
import React, { useState } from 'react';
import Provenance from '../metrics/Provenance';
import {
  IconSparkles, IconCheckCircle, IconAlertTriangle, IconRefresh, IconEye,
} from '../dashboard/icons';
import { analyzeImage } from '../../api/ai';
import { compareImages } from '../../lib/imageDiff';
import { API_BASE_URL } from '../../config';

// Fetch a served image back as a File so it can be posted to /ai/analyze-image,
// which takes multipart upload rather than a URL.
//
// This is the only raw fetch() in the app — everything else goes through
// api/client. It has to be: /uploads is a static mount, not a JSON endpoint.
// That makes it the one call that can fail in ways the rest of the app cannot,
// and a bare TypeError here surfaced to a municipal officer as the literal
// words "Failed to fetch", which tells them nothing about what to do.
//
// So: absolute-ise the URL against the API host (a relative /uploads/... path
// would otherwise resolve against the dev server and quietly return its index
// page), and translate every failure mode into something actionable.
async function urlToFile(url, name = 'evidence.jpg') {
  if (!url) throw new Error('This photo has no address recorded, so it cannot be checked.');
  const absolute = /^https?:\/\//i.test(url) ? url : `${API_BASE_URL}${url}`;

  let res;
  try {
    res = await fetch(absolute, { cache: 'no-store' });
  } catch (err) {
    // fetch only rejects on a network-level failure: the API host is down, the
    // request was blocked (CORS, an extension), or the browser is offline.
    throw new Error(
      navigator.onLine === false
        ? 'You appear to be offline, so the photo could not be loaded.'
        : `Could not reach ${new URL(absolute).origin} to load the photo. `
          + 'Check the backend is running and that it allows this page to read /uploads.',
    );
  }

  if (!res.ok) {
    throw new Error(res.status === 404
      ? 'The photo is recorded on this complaint but is missing from the server.'
      : `The photo could not be loaded (HTTP ${res.status}).`);
  }

  const blob = await res.blob();
  if (!blob.size) throw new Error('The photo came back empty, so there is nothing to analyse.');
  return new File([blob], name, { type: blob.type || 'image/jpeg' });
}

const VERDICT = {
  consistent: {
    tone: 'bg-teal-50 border-teal-100 text-teal-800',
    icon: IconCheckCircle,
    label: 'Consistent with a completed fix',
  },
  persists: {
    tone: 'bg-caution-50 border-caution-100 text-caution-800',
    icon: IconAlertTriangle,
    label: 'The reported problem may still be present',
  },
  inconclusive: {
    tone: 'bg-surface-inset border-line text-ink-body',
    icon: IconEye,
    label: 'Inconclusive — judge from the photos',
  },
};

export default function AiVerificationPanel({ complaint, beforePhotos, afterPhotos, busy }) {
  const [running, setRunning] = useState(false);
  const [vision, setVision] = useState(null);
  const [diff, setDiff] = useState(null);
  const [error, setError] = useState('');

  const canRun = afterPhotos.length > 0;

  const run = async () => {
    setRunning(true);
    setError('');
    setVision(null);
    setDiff(null);
    try {
      // Started first and awaited separately: the similarity number never
      // throws (it reports its own reason), so it must not be discarded just
      // because the vision call failed — and vice versa. Promise.all here meant
      // one failure wiped out both results.
      const diffPromise = compareImages(beforePhotos[0]?.url, afterPhotos[0]?.url);
      try {
        const file = await urlToFile(afterPhotos[0].url);
        setVision(await analyzeImage(file));
      } catch (err) {
        if (err.name !== 'SessionExpiredError') setError(err.message);
      }
      setDiff(await diffPromise);
    } catch (err) {
      if (err.name !== 'SessionExpiredError') setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  // Does what the model sees now still look like the original complaint?
  let verdict = null;
  if (vision?.available !== false && vision) {
    const stillSameCategory = vision.categoryId && vision.categoryId === complaint.categoryId;
    const sawNothing = !vision.categoryId && !vision.description;
    if (sawNothing) verdict = 'inconclusive';
    else if (stillSameCategory) verdict = 'persists';
    else verdict = 'consistent';
  }

  const v = verdict ? VERDICT[verdict] : null;
  const VIcon = v?.icon;

  return (
    <div className="mt-3 rounded-lg border border-line bg-surface p-3">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <IconSparkles size={13} className="text-civic-600 shrink-0" />
          <h4 className="text-[12px] font-bold text-ink">AI verification</h4>
          <Provenance level="ai">Recommendation</Provenance>
        </div>
        <button
          onClick={run}
          disabled={!canRun || running || busy}
          title={canRun ? undefined : 'Needs a completion photo'}
          className="focus-ring shrink-0 inline-flex items-center gap-1.5 text-[11px] font-semibold text-civic-700 hover:bg-civic-50 disabled:opacity-40 disabled:cursor-not-allowed px-2 py-1 rounded transition-colors"
        >
          <IconRefresh size={12} className={running ? 'animate-spin-slow' : ''} />
          {running ? 'Checking…' : vision ? 'Re-check' : 'Check evidence'}
        </button>
      </div>

      {!canRun && (
        <p className="text-[11px] text-ink-muted">
          No completion photo has been submitted, so there is nothing to check.
        </p>
      )}

      {error && (
        <p role="alert" className="text-[11px] text-danger-700 bg-danger-50 border border-danger-100 rounded px-2 py-1.5">
          {error}
        </p>
      )}

      {vision?.available === false && (
        <p className="text-[11px] text-caution-800 bg-caution-50 border border-caution-100 rounded px-2 py-1.5">
          {vision.unavailableReason || 'Image analysis is not switched on for this deployment.'}
        </p>
      )}

      {v && (
        <div className={`rounded-md border px-2.5 py-2 ${v.tone}`}>
          <div className="flex items-center gap-1.5 text-[12px] font-semibold">
            <VIcon size={13} /> {v.label}
          </div>

          {vision.description && (
            <p className="text-[11px] mt-1.5 leading-snug opacity-90">
              <span className="font-semibold">The model sees:</span> {vision.description}
            </p>
          )}

          {/* What it saw, against what was reported. The comparison is the
              useful part — the raw label on its own means little. */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[10px]">
            <span>
              Reported as <span className="font-semibold">{complaint.category}</span>
            </span>
            <span>
              Now reads as{' '}
              <span className="font-semibold">{vision.categoryName || 'no clear issue'}</span>
            </span>
            {typeof vision.confidence === 'number' && (
              <span className="tnum">confidence {Math.round(vision.confidence * 100)}%</span>
            )}
            {vision.source && <span>{vision.source === 'rules' ? 'rules engine' : 'model'}</span>}
          </div>

          {Array.isArray(vision.observations) && vision.observations.length > 0 && (
            <ul className="mt-2 space-y-0.5">
              {vision.observations.slice(0, 4).map((o) => (
                <li key={o} className="text-[10px] opacity-85 flex items-start gap-1">
                  <span className="opacity-50">·</span> {o}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Similarity, deliberately secondary. */}
      {diff && (
        <div className="mt-2 pt-2 border-t border-line">
          {diff.similarity === null ? (
            <p className="text-[10px] text-ink-faint">{diff.reason}</p>
          ) : (
            <>
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="text-ink-muted">Visual difference from the original</span>
                <span className="font-semibold text-ink tnum">
                  {(100 - diff.similarity).toFixed(0)}% changed
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-inset overflow-hidden">
                <div
                  className="h-full rounded-full bg-civic-500 transition-[width] duration-500"
                  style={{ width: `${100 - diff.similarity}%` }}
                />
              </div>
              <p className="text-[10px] text-ink-faint mt-1.5 leading-snug">
                A supporting signal only. A large change can mean the problem is gone — or that the
                photo is of somewhere else. A small change can mean nothing was done — or that it
                was a small fix shot from the same angle.
              </p>
            </>
          )}
        </div>
      )}

      {vision && (
        <p className="text-[10px] text-ink-faint mt-2">
          Nothing here changes the complaint. Verification remains your decision.
        </p>
      )}
    </div>
  );
}
