// Report an Issue — the citizen's complaint form.
//
// Backend constraints that shape this page:
//   - POST /complaints/ needs real latitude/longitude AND a non-null address
//     (locations.address is NOT NULL), so both must be present before submit.
//   - Photos are a second, separate request against the new complaint id, so
//     they can fail after the complaint itself is safely saved.
//
// The AI here is entirely advisory. It drafts, suggests and warns; it never
// changes what gets submitted without the citizen accepting it. Filing a
// complaint must work with the AI switched off, so every AI call fails silently.
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  IconAlertTriangle, IconTrash, IconDroplet, IconBulb, IconMoreHorizontal,
  IconUpload, IconX, IconMapPin, IconCrosshair, IconSparkles, IconSend,
  IconCheckCircle, IconRefresh,
} from '../components/dashboard/icons';
import { createComplaint } from '../api/complaints';
import { triage as runTriage, analyzeImage, rewriteDescription } from '../api/ai';
import { reverseGeocode } from '../api/geocode';
import useCategories from '../hooks/useCategories';

const CATEGORY_ICONS = {
  'CAT-ROA-01': IconAlertTriangle,
  'CAT-SAN-01': IconTrash,
  'CAT-WAT-01': IconDroplet,
  'CAT-ELE-01': IconBulb,
  'CAT-PUB-01': IconMoreHorizontal,
};

const MAX_IMAGE_MB = 5;
const MAX_IMAGES = 5;

// Classification fires this soon after typing stops. Short enough to feel
// immediate, long enough not to fire on every keystroke mid-word.
const TRIAGE_DELAY_MS = 350;
const MIN_CHARS_TO_CLASSIFY = 15;

export default function ReportIssue() {
  const { categories: CATEGORIES } = useCategories();
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState(null);
  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

  // Photos: [{ id, file, url }]. Object URLs are revoked on removal and unmount.
  const [photos, setPhotos] = useState([]);
  const [dragging, setDragging] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  const [triage, setTriage] = useState(null);
  const [triaging, setTriaging] = useState(false);
  // Which classification steps have actually completed. Each entry is a real
  // network call that returned — no timer-driven bar, because /ai/triage is a
  // single request and any percentage inside it would be fabricated.
  const [aiStage, setAiStage] = useState(null);

  // AI description drafting.
  const [drafting, setDrafting] = useState(false);
  const [priorDescription, setPriorDescription] = useState(null); // for undo

  const selected = CATEGORIES.find((c) => c.categoryId === categoryId);

  const suggestedCategory = (() => {
    const top = triage?.category?.suggestions?.[0];
    if (!top?.categoryId) return null;
    return CATEGORIES.find((c) => c.categoryId === top.categoryId) || null;
  })();

  // ── Location ────────────────────────────────────────────────────
  const captureLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setMessage({ text: 'This browser cannot share your location, which is required to file a complaint.', type: 'error' });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setMessage({ text: 'Could not get your location. Allow location access and try again.', type: 'error' });
        setLocating(false);
      },
      { timeout: 10000 },
    );
  }, []);

  useEffect(() => { captureLocation(); }, [captureLocation]);

  // Turn the coordinates into a street address. The backend requires a non-null
  // address, so filling it automatically removes a mandatory field the citizen
  // would otherwise have to type from a map in their head.
  //
  // Only runs when coordinates actually change — Nominatim's usage policy is
  // about one request per second, and this must never be on a timer. It stays
  // editable either way: the lookup is a convenience, not the source of truth.
  useEffect(() => {
    if (!coords) return undefined;
    const controller = new AbortController();
    setGeocoding(true);
    reverseGeocode(coords, { signal: controller.signal })
      .then((found) => {
        // Do not clobber something the citizen has already typed.
        if (found) setAddress((cur) => (cur.trim() ? cur : found));
      })
      .finally(() => setGeocoding(false));
    return () => controller.abort();
  }, [coords]);

  // ── Live classification ─────────────────────────────────────────
  useEffect(() => {
    const text = description.trim();
    if (text.length < MIN_CHARS_TO_CLASSIFY) {
      setTriage(null);
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setTriaging(true);
      setAiStage({ done: 0, total: 2, label: 'Reading your description' });
      try {
        const result = await runTriage({
          description: text,
          categoryId,
          latitude: coords?.latitude,
          longitude: coords?.longitude,
        });
        if (!cancelled) {
          setAiStage({ done: 2, total: 2, label: 'Classification complete' });
          setTriage(result);
        }
      } catch {
        // Never block filing on the AI being up.
        if (!cancelled) setTriage(null);
      } finally {
        if (!cancelled) {
          setTriaging(false);
          // Clear the strip shortly after completion so it does not linger as
          // permanent chrome on a form the citizen is still filling in.
          setTimeout(() => setAiStage(null), 1600);
        }
      }
    }, TRIAGE_DELAY_MS);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [description, categoryId, coords]);

  // ── Photos ──────────────────────────────────────────────────────
  const addFiles = useCallback((fileList) => {
    const incoming = Array.from(fileList || []);
    if (!incoming.length) return;

    const accepted = [];
    for (const file of incoming) {
      if (!file.type.startsWith('image/')) {
        setMessage({ text: `${file.name} is not an image — skipped.`, type: 'warning' });
        continue;
      }
      if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
        setMessage({ text: `${file.name} is over ${MAX_IMAGE_MB}MB — skipped.`, type: 'warning' });
        continue;
      }
      accepted.push(file);
    }

    setPhotos((cur) => {
      const room = MAX_IMAGES - cur.length;
      if (room <= 0) {
        setMessage({ text: `You can attach up to ${MAX_IMAGES} photos.`, type: 'warning' });
        return cur;
      }
      if (accepted.length > room) {
        setMessage({ text: `Only the first ${room} photo${room === 1 ? '' : 's'} were added — the limit is ${MAX_IMAGES}.`, type: 'warning' });
      }
      const next = accepted.slice(0, room).map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}`,
        file,
        url: URL.createObjectURL(file),
      }));
      return [...cur, ...next];
    });
  }, []);

  const removePhoto = (id) => {
    setPhotos((cur) => {
      const gone = cur.find((p) => p.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      return cur.filter((p) => p.id !== id);
    });
    if (fileRef.current) fileRef.current.value = '';
  };

  // Revoke every outstanding object URL when the page unmounts.
  useEffect(() => () => {
    setPhotos((cur) => {
      cur.forEach((p) => URL.revokeObjectURL(p.url));
      return cur;
    });
  }, []);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  // ── AI description ──────────────────────────────────────────────
  // Draft from the first photo. This is the strongest version of "let the AI
  // write it": a citizen who can photograph a problem does not have to find
  // words for it.
  const draftFromPhoto = async () => {
    if (!photos.length) return;
    setDrafting(true);
    setMessage({ text: '', type: '' });
    setAiStage({ done: 0, total: 2, label: 'Looking at your photo' });
    try {
      const res = await analyzeImage(photos[0].file);
      setAiStage({ done: 1, total: 2, label: 'Drafting a description' });
      if (res?.available === false) {
        setMessage({ text: res.unavailableReason || 'Photo analysis is not switched on.', type: 'warning' });
        return;
      }
      if (!res?.description) {
        setMessage({ text: 'The photo could not be described. Try writing a short note instead.', type: 'warning' });
        return;
      }
      setPriorDescription(description);
      setDescription(res.description);
      if (res.categoryId && !categoryId) setCategoryId(res.categoryId);
    } catch {
      setMessage({ text: 'Photo analysis is unavailable right now.', type: 'warning' });
    } finally {
      setDrafting(false);
      setTimeout(() => setAiStage(null), 1600);
    }
  };

  // Rewrite what the citizen typed into something an officer can act on.
  const improveWriting = async () => {
    const text = description.trim();
    if (text.length < MIN_CHARS_TO_CLASSIFY) return;
    setDrafting(true);
    setMessage({ text: '', type: '' });
    try {
      const res = await rewriteDescription({ description: text, categoryId });
      if (!res?.rewritten || res.rewritten === text) {
        setMessage({ text: 'The description already reads clearly.', type: 'warning' });
        return;
      }
      setPriorDescription(description);
      setDescription(res.rewritten);
    } catch {
      setMessage({ text: 'Rewriting is unavailable right now.', type: 'warning' });
    } finally {
      setDrafting(false);
    }
  };

  const undoDraft = () => {
    if (priorDescription === null) return;
    setDescription(priorDescription);
    setPriorDescription(null);
  };

  // ── Submit ──────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!categoryId) return setMessage({ text: 'Please select an issue category.', type: 'error' });
    if (!description.trim()) return setMessage({ text: 'Please describe the issue.', type: 'error' });
    if (!address.trim()) return setMessage({ text: 'Please provide a street address or landmark.', type: 'error' });
    if (!coords) {
      return setMessage({
        text: 'Your location is required to file a complaint. Tap "Use Current Location" to capture it.',
        type: 'error',
      });
    }

    setMessage({ text: '', type: '' });
    setLoading(true);
    try {
      const { complaint, imageError } = await createComplaint({
        description: description.trim(),
        categoryId,
        address: address.trim(),
        latitude: coords.latitude,
        longitude: coords.longitude,
        images: photos.map((p) => p.file),
      });

      setMessage({
        text: imageError
          ? `Complaint ${complaint.id} was filed, but the photos did not upload (${imageError}).`
          : `Complaint ${complaint.id} submitted successfully! Redirecting…`,
        type: imageError ? 'warning' : 'success',
      });
      setTimeout(() => navigate(`/complaints/${complaint.id}`), imageError ? 4000 : 1200);
    } catch (err) {
      if (err.name !== 'SessionExpiredError') setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const messageStyles = {
    error: 'bg-red-50 text-red-700 border-red-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };

  const duplicates = triage?.duplicates?.candidates || [];

  return (
    <div className="max-w-[760px] mx-auto">
      <h1 className="font-display text-2xl font-bold text-ink mb-1">Report an Issue</h1>
      <p className="text-[14px] text-ink-muted mb-6">Tell us what's wrong and where — we'll route it to the right team.</p>

      {message.text && (
        <div className={`mb-5 px-4 py-3 rounded-xl text-[13px] font-medium border ${messageStyles[message.type] || messageStyles.error}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-line shadow-sm p-6 space-y-7">
        {/* 1. Photos — first, because a photo can write the description. */}
        <section>
          <h2 className="font-semibold text-ink text-[15px] mb-1">1. Add Photos</h2>
          <p className="text-[13px] text-ink-muted mb-3">
            Up to {MAX_IMAGES}. A clear photo lets us draft the description for you.
          </p>

          <label
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`cursor-pointer rounded-xl border-2 border-dashed p-6 flex flex-col items-center justify-center text-center transition-colors ${
              dragging ? 'border-primary bg-emerald-50' : 'border-slate-300 hover:border-primary hover:bg-slate-50'
            }`}
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg"
              multiple
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
            <span className="w-10 h-10 rounded-full bg-emerald-50 text-primary flex items-center justify-center mb-2">
              <IconUpload size={20} />
            </span>
            <span className="text-[13px] font-medium text-ink-body">Click to upload or drag &amp; drop</span>
            <span className="text-[12px] text-ink-faint mt-0.5">
              JPG or PNG, up to {MAX_IMAGE_MB}MB each · {photos.length}/{MAX_IMAGES} added
            </span>
          </label>

          {photos.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mt-3">
              {photos.map((p, i) => (
                <div key={p.id} className="relative group animate-scale-in">
                  <img src={p.url} alt="" className="w-full aspect-square object-cover rounded-xl border border-line" />
                  {i === 0 && (
                    <span className="absolute bottom-1 left-1 text-[9px] font-semibold bg-slate-900/70 text-white px-1.5 py-0.5 rounded">
                      Used for AI
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removePhoto(p.id)}
                    className="focus-ring absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow"
                    aria-label="Remove photo"
                  >
                    <IconX size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 2. Description, with AI drafting */}
        <section>
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <h2 className="font-semibold text-ink text-[15px]">2. Describe the Issue</h2>
            <div className="flex items-center gap-2">
              {priorDescription !== null && (
                <button
                  type="button"
                  onClick={undoDraft}
                  className="focus-ring text-[12px] font-semibold text-ink-muted hover:text-ink px-2 py-1 rounded-md hover:bg-slate-100 transition"
                >
                  Undo
                </button>
              )}
              <button
                type="button"
                onClick={draftFromPhoto}
                disabled={!photos.length || drafting}
                title={photos.length ? 'Describe the first photo' : 'Add a photo first'}
                className="focus-ring inline-flex items-center gap-1.5 text-[12px] font-semibold text-primary bg-emerald-50 hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed px-2.5 py-1.5 rounded-lg transition"
              >
                <IconSparkles size={13} /> Write from photo
              </button>
              <button
                type="button"
                onClick={improveWriting}
                disabled={description.trim().length < MIN_CHARS_TO_CLASSIFY || drafting}
                className="focus-ring inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink-body bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed px-2.5 py-1.5 rounded-lg transition"
              >
                <IconRefresh size={13} /> Improve
              </button>
            </div>
          </div>

          <div className="relative">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="What's wrong? A sentence or two is plenty — or add a photo and let us draft it."
              className="focus-ring w-full rounded-xl border border-line p-3.5 text-[14px] text-ink outline-none resize-y transition"
            />
            {drafting && (
              <div className="absolute inset-0 rounded-xl bg-white/70 flex items-center justify-center">
                <span className="inline-flex items-center gap-2 text-[13px] font-medium text-primary">
                  <span className="w-4 h-4 border-2 border-emerald-200 rounded-full border-t-primary animate-spin-slow" />
                  Writing…
                </span>
              </div>
            )}
          </div>
        </section>

        {/* 3. Category */}
        <section>
          <h2 className="font-semibold text-ink text-[15px] mb-3">3. Category</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {CATEGORIES.map((c) => {
              const Icon = CATEGORY_ICONS[c.categoryId] || IconMoreHorizontal;
              const active = categoryId === c.categoryId;
              return (
                <button
                  type="button"
                  key={c.categoryId}
                  onClick={() => setCategoryId(c.categoryId)}
                  title={c.name}
                  className={`focus-ring flex flex-col items-center gap-2 py-4 px-2 rounded-xl border text-[13px] font-medium transition-colors ${
                    active
                      ? 'border-primary bg-emerald-50 text-primary'
                      : 'border-line text-ink-body hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <Icon size={22} />
                  {c.label}
                </button>
              );
            })}
          </div>
          {selected && (
            <p className="text-[12px] text-ink-faint mt-2">Routes to the {selected.department} department.</p>
          )}
        </section>

        {/* 4. Location */}
        <section>
          <h2 className="font-semibold text-ink text-[15px] mb-3">4. Location</h2>
          <div className="flex items-center gap-2 rounded-xl border border-line px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-emerald-100 transition">
            <IconMapPin size={18} className="text-primary shrink-0" />
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={geocoding ? 'Looking up address…' : 'Street address or landmark'}
              className="flex-1 py-3 text-[14px] text-ink outline-none bg-transparent"
            />
            <button
              type="button"
              onClick={captureLocation}
              disabled={locating}
              className="focus-ring shrink-0 inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline disabled:opacity-60"
            >
              <IconCrosshair size={14} /> {locating ? 'Locating…' : 'Use Current Location'}
            </button>
          </div>
          <p className={`text-[12px] mt-2 ${coords ? 'text-ink-faint' : 'text-amber-700'}`}>
            {coords
              ? `GPS captured: ${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}${geocoding ? ' · finding address…' : ''}`
              : 'GPS coordinates are required — tap "Use Current Location" to capture them.'}
          </p>
        </section>

        {/* Background classification progress. Shown while the request is in
            flight so the citizen knows work is happening on their behalf. */}
        {aiStage && (
          <div role="status" aria-live="polite" className="rounded-lg border border-line bg-surface-inset px-3.5 py-2.5">
            <div className="flex items-center justify-between gap-2 text-[12px]">
              <span className="inline-flex items-center gap-1.5 text-ink-body font-medium">
                <IconSparkles size={13} className="text-civic-600" />
                {aiStage.label}
              </span>
              <span className="text-ink-faint tnum">
                {Math.round((aiStage.done / aiStage.total) * 100)}%
              </span>
            </div>
            <div className="mt-1.5 h-1 rounded-full bg-line overflow-hidden">
              <div
                className="h-full rounded-full bg-civic-600 transition-[width] duration-500"
                style={{ width: `${(aiStage.done / aiStage.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* 5. Live AI assessment */}
        {(triaging || triage) && (
          <section className="rounded-xl border border-line bg-slate-50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <IconSparkles size={14} className="text-primary" />
              <h2 className="font-semibold text-ink text-[14px]">AI assessment</h2>
              {triaging && <span className="text-[11px] text-ink-faint">checking…</span>}
              {!triaging && triage?.source && (
                <span className="text-[10px] text-ink-faint ml-auto">
                  {triage.source === 'rules' ? 'Rules engine' : 'Model'}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-white rounded-lg border border-line p-3">
                <div className="text-[11px] text-ink-faint">Suggested category</div>
                <div className="text-[14px] font-semibold text-ink mt-0.5">
                  {suggestedCategory?.label || '—'}
                </div>
                {suggestedCategory && suggestedCategory.categoryId !== categoryId && (
                  <button
                    type="button"
                    onClick={() => setCategoryId(suggestedCategory.categoryId)}
                    className="focus-ring mt-2 text-[12px] font-semibold text-primary hover:underline"
                  >
                    Use this instead
                  </button>
                )}
                {suggestedCategory && suggestedCategory.categoryId === categoryId && (
                  <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-primary">
                    <IconCheckCircle size={12} /> matches your choice
                  </div>
                )}
              </div>

              <div className="bg-white rounded-lg border border-line p-3">
                <div className="text-[11px] text-ink-faint">Predicted severity</div>
                <div className="text-[14px] font-semibold text-ink mt-0.5">
                  {triage?.severity?.severity
                    ? triage.severity.severity.charAt(0) + triage.severity.severity.slice(1).toLowerCase()
                    : '—'}
                </div>
                {triage?.severity?.reason && (
                  <p className="text-[11px] text-ink-muted mt-1 leading-snug">{triage.severity.reason}</p>
                )}
              </div>
            </div>

            {/* Catching a duplicate here costs the citizen nothing and saves an
                officer a merge later. It never blocks submission — the issue
                nearby may genuinely be a different one. */}
            {duplicates.length > 0 && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div className="flex items-center gap-1.5 text-[12px] font-semibold text-amber-900 mb-2">
                  <IconAlertTriangle size={13} />
                  Someone may have reported this already
                </div>
                <ul className="space-y-1.5">
                  {duplicates.slice(0, 3).map((d) => (
                    <li key={d.complaintId} className="flex items-center gap-2 text-[12px]">
                      <Link to={`/complaints/${d.complaintId}`} className="font-mono text-primary hover:underline">
                        {d.complaintId}
                      </Link>
                      <span className="text-ink-muted truncate flex-1">{d.description}</span>
                      {typeof d.distanceKm === 'number' && (
                        <span className="text-ink-faint whitespace-nowrap">
                          {d.distanceKm < 1 ? `${Math.round(d.distanceKm * 1000)}m` : `${d.distanceKm.toFixed(1)}km`}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-amber-800 mt-2">
                  Still different? Carry on — reporting it again helps us see how widespread it is.
                </p>
              </div>
            )}
          </section>
        )}

        <button
          type="submit"
          disabled={loading}
          className="focus-ring w-full inline-flex items-center justify-center gap-2 bg-primary hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-[15px] py-3.5 rounded-xl shadow-btn transition-colors"
        >
          {loading ? (
            <span className="w-[18px] h-[18px] border-2 border-white/40 rounded-full border-t-white animate-spin-slow" />
          ) : (
            <>
              <IconSend size={18} /> Submit Complaint
            </>
          )}
        </button>
      </form>
    </div>
  );
}
