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

// Three steps, not the six a brief might suggest. Two of those six -- running
// the classifier and reading its answer -- are things the system does, not
// things a citizen does, and putting a "step" around waiting makes the form
// feel longer than it is. Classification runs while the description is typed
// and its result is shown in place.
const STEPS = [
  { key: 'what', label: 'What happened', hint: 'A photo and a sentence' },
  { key: 'where', label: 'Where it is', hint: 'We use your location' },
  { key: 'check', label: 'Check and send', hint: 'Confirm before filing' },
];

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

  // Which step is on screen. The form is one object throughout -- stepping is
  // presentation only, so going back never discards what was typed.
  const [step, setStep] = useState(0);

  const [drafting, setDrafting] = useState(false);
  const [priorDescription, setPriorDescription] = useState(null); // for undo


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
      try {
        const result = await runTriage({
          description: text,
          categoryId,
          latitude: coords?.latitude,
          longitude: coords?.longitude,
        });
        if (!cancelled) {
          setTriage(result);
        }
      } catch {
        // Never block filing on the AI being up.
        if (!cancelled) setTriage(null);
      } finally {
        if (!cancelled) setTriaging(false);
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
    try {
      const res = await analyzeImage(photos[0].file);
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
    error: 'bg-danger-50 text-danger-700 border-danger-100',
    warning: 'bg-caution-50 text-caution-800 border-caution-100',
    success: 'bg-teal-50 text-teal-800 border-teal-100',
  };

  const duplicates = triage?.duplicates?.candidates || [];

  // What blocks moving on. Stated per step so the button can say why it is
  // disabled instead of simply refusing.
  const blocking = (() => {
    if (step === 0) {
      if (description.trim().length < MIN_CHARS_TO_CLASSIFY) {
        return 'Describe the problem in a sentence or two.';
      }
      return null;
    }
    if (step === 1) {
      if (!coords) return 'Your location is needed so the right depot is sent.';
      if (!address.trim()) return 'Add a street or landmark.';
      return null;
    }
    if (!categoryId) return 'Choose the category this falls under.';
    return null;
  })();

  return (
    <div className="max-w-[820px] mx-auto pb-10">
      <header className="mb-6">
        <h1 className="font-display text-[26px] font-bold text-ink leading-tight">
          Report a problem
        </h1>
        <p className="text-[14px] text-ink-muted mt-1">
          It takes about a minute. You will get a reference and a date it is due by.
        </p>
      </header>

      {/* Progress. Steps already passed are clickable, so going back to change
          an answer does not mean starting again. */}
      <ol className="flex items-stretch gap-2 mb-6">
        {STEPS.map((s2, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <li key={s2.key} className="flex-1">
              <button
                type="button"
                disabled={i > step}
                onClick={() => setStep(i)}
                className={`focus-ring w-full text-left rounded-xl border px-3.5 py-3 transition-all ${
                  current
                    ? 'bg-surface border-civic-400 shadow-sm'
                    : done
                      ? 'bg-teal-50/60 border-teal-100 hover:border-teal-300'
                      : 'bg-surface-inset border-line opacity-60 cursor-not-allowed'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 ${
                      done
                        ? 'bg-teal-500 text-white'
                        : current
                          ? 'bg-civic-700 text-white'
                          : 'bg-line text-ink-faint'
                    }`}
                  >
                    {done ? <IconCheckCircle size={12} /> : i + 1}
                  </span>
                  <span className={`text-[13px] font-semibold truncate ${current ? 'text-ink' : 'text-ink-body'}`}>
                    {s2.label}
                  </span>
                </span>
                <span className="block text-[11.5px] text-ink-faint mt-1 pl-7 truncate">
                  {s2.hint}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {message.text && (
        <div className={`mb-5 px-4 py-3 rounded-xl text-[13px] font-medium border ${messageStyles[message.type] || messageStyles.error}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* ── Step 1: what happened ─────────────────────────────── */}
        {step === 0 && (
          <div className="space-y-5 animate-rise-in">
            <section className="bg-surface rounded-2xl border border-line shadow-sm p-5">
              <h2 className="font-display text-[15px] font-bold text-ink">Add a photo</h2>
              <p className="text-[13px] text-ink-muted mt-1 mb-4">
                Optional, but it is the fastest way to explain the problem — and we can write the
                description from it.
              </p>

              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                className={`rounded-xl border-2 border-dashed px-5 py-7 text-center transition-colors ${
                  dragging ? 'border-civic-500 bg-civic-50' : 'border-line bg-surface-inset'
                }`}
              >
                <IconUpload size={22} className="mx-auto text-ink-faint" />
                <p className="text-[13.5px] text-ink-body mt-2">
                  Drag a photo here, or{' '}
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="focus-ring rounded font-semibold text-civic-700 hover:underline"
                  >
                    choose a file
                  </button>
                </p>
                <p className="text-[11.5px] text-ink-faint mt-1">
                  Up to {MAX_IMAGES} photos, {MAX_IMAGE_MB}MB each.
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) => addFiles(e.target.files)}
                />
              </div>

              {photos.length > 0 && (
                <>
                  <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 mt-4">
                    {photos.map((ph) => (
                      <li key={ph.id} className="relative group">
                        <img
                          src={ph.url}
                          alt="Attached"
                          className="w-full aspect-[4/3] object-cover rounded-lg border border-line"
                        />
                        <button
                          type="button"
                          onClick={() => removePhoto(ph.id)}
                          aria-label="Remove photo"
                          className="focus-ring absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-ink text-white flex items-center justify-center shadow-md"
                        >
                          <IconX size={12} />
                        </button>
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    onClick={draftFromPhoto}
                    disabled={drafting}
                    className="focus-ring inline-flex items-center gap-2 mt-4 text-[13px] font-semibold text-civic-700 bg-civic-50 hover:bg-civic-100 disabled:opacity-60 px-3.5 py-2 rounded-lg transition-colors"
                  >
                    <IconSparkles size={14} />
                    {drafting ? 'Reading the photo…' : 'Describe this photo for me'}
                  </button>
                </>
              )}
            </section>

            <section className="bg-surface rounded-2xl border border-line shadow-sm p-5">
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <h2 className="font-display text-[15px] font-bold text-ink">What is wrong?</h2>
                {triaging && (
                  <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-muted">
                    <IconRefresh size={12} className="animate-spin-slow" />
                    Working out the category…
                  </span>
                )}
              </div>

              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                placeholder="For example: the streetlight outside 42 Kasturba Road has been out for a week and the crossing is completely dark at night."
                className="w-full mt-3 rounded-xl border border-line bg-surface p-3.5 text-[14px] text-ink outline-none resize-y focus:border-civic-500 focus:ring-2 focus:ring-civic-500/15 transition"
              />

              <div className="flex items-center gap-3 flex-wrap mt-2">
                <span className="text-[11.5px] text-ink-faint">
                  {description.trim().length} characters
                </span>
                {description.trim().length >= MIN_CHARS_TO_CLASSIFY && (
                  <button
                    type="button"
                    onClick={improveWriting}
                    disabled={drafting}
                    className="focus-ring text-[12.5px] font-semibold text-civic-700 hover:underline disabled:opacity-60"
                  >
                    {drafting ? 'Rewriting…' : 'Tidy up my wording'}
                  </button>
                )}
                {priorDescription !== null && (
                  <button
                    type="button"
                    onClick={undoDraft}
                    className="focus-ring text-[12.5px] font-semibold text-ink-muted hover:text-ink"
                  >
                    Undo
                  </button>
                )}
              </div>

              {/* The duplicate warning, as soon as there is something to warn
                  about. Shown here rather than at submit: telling someone their
                  report is a duplicate after they have written it is too late
                  to save them the writing. */}
              {duplicates.length > 0 && (
                <div className="mt-4 rounded-xl border border-caution-100 bg-caution-50 p-3.5">
                  <p className="text-[13px] font-semibold text-caution-800">
                    {duplicates.length === 1
                      ? 'Someone may have reported this already'
                      : `${duplicates.length} similar reports are already open nearby`}
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {duplicates.slice(0, 3).map((d) => (
                      <li key={d.complaintId} className="text-[12.5px] text-caution-800">
                        <span className="font-mono">{d.complaintId}</span>
                        {d.description ? ` — ${d.description.slice(0, 70)}` : ''}
                      </li>
                    ))}
                  </ul>
                  <p className="text-[12px] text-caution-800/80 mt-2 leading-snug">
                    You can still file yours — more reports of the same problem raise its priority.
                  </p>
                </div>
              )}
            </section>
          </div>
        )}

        {/* ── Step 2: where ─────────────────────────────────────── */}
        {step === 1 && (
          <section className="bg-surface rounded-2xl border border-line shadow-sm p-5 animate-rise-in">
            <h2 className="font-display text-[15px] font-bold text-ink">Where is it?</h2>
            <p className="text-[13px] text-ink-muted mt-1 mb-4">
              Your device's location is used so the report reaches the depot that covers that
              street. You can correct the address if it is not quite right.
            </p>

            <div className={`rounded-xl border px-4 py-3.5 flex items-start gap-3 ${
              coords ? 'border-teal-100 bg-teal-50/60' : 'border-caution-100 bg-caution-50'
            }`}>
              <IconMapPin size={16} className={coords ? 'text-teal-700 mt-0.5' : 'text-caution-700 mt-0.5'} />
              <div className="min-w-0 flex-1">
                {coords ? (
                  <>
                    <p className="text-[13px] font-semibold text-ink">Location captured</p>
                    <p className="text-[12px] text-ink-muted font-mono mt-0.5">
                      {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
                    </p>
                  </>
                ) : (
                  <p className="text-[13px] text-caution-800">
                    {locating ? 'Getting your location…' : 'No location yet.'}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={captureLocation}
                disabled={locating}
                className="focus-ring shrink-0 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-civic-700 bg-surface border border-line px-3 py-1.5 rounded-lg hover:border-civic-400 disabled:opacity-60 transition-colors"
              >
                <IconCrosshair size={13} className={locating ? 'animate-spin-slow' : ''} />
                {coords ? 'Update' : 'Use my location'}
              </button>
            </div>

            <label className="block text-[11px] font-semibold uppercase tracking-wide text-ink-muted mt-5 mb-1.5" htmlFor="ri-address">
              Street or landmark
            </label>
            <input
              id="ri-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={geocoding ? 'Looking up the address…' : 'e.g. 42 Kasturba Road, near the school gate'}
              className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-civic-500 focus:ring-2 focus:ring-civic-500/15 transition"
            />
            <p className="text-[11.5px] text-ink-faint mt-1.5">
              Filled in from your coordinates where we can. A landmark helps the crew find it.
            </p>
          </section>
        )}

        {/* ── Step 3: check and send ────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-5 animate-rise-in">
            <section className="bg-surface rounded-2xl border border-line shadow-sm p-5">
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <h2 className="font-display text-[15px] font-bold text-ink">Category</h2>
                {suggestedCategory && (
                  <span className="inline-flex items-center gap-1.5 text-[12px] text-civic-700">
                    <IconSparkles size={12} />
                    Suggested: {suggestedCategory.label}
                  </span>
                )}
              </div>
              <p className="text-[13px] text-ink-muted mt-1 mb-4">
                Change it if the suggestion is wrong — an officer checks this before anyone is
                sent out.
              </p>

              <div className="grid sm:grid-cols-2 gap-2.5">
                {CATEGORIES.map((c) => {
                  const Icon = CATEGORY_ICONS[c.categoryId] || IconMoreHorizontal;
                  const active = categoryId === c.categoryId;
                  const isSuggested = suggestedCategory?.categoryId === c.categoryId;
                  return (
                    <button
                      key={c.categoryId}
                      type="button"
                      onClick={() => setCategoryId(c.categoryId)}
                      className={`focus-ring flex items-center gap-3 text-left rounded-xl border px-3.5 py-3 transition-all ${
                        active
                          ? 'border-civic-500 bg-civic-50 shadow-sm'
                          : 'border-line bg-surface hover:border-civic-300'
                      }`}
                    >
                      <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        active ? 'bg-civic-700 text-white' : 'bg-surface-inset text-ink-muted'
                      }`}>
                        <Icon size={17} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[13.5px] font-semibold text-ink truncate">
                          {c.label}
                        </span>
                        <span className="block text-[11.5px] text-ink-faint truncate">
                          {isSuggested ? 'Suggested for you' : c.department}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="bg-surface rounded-2xl border border-line shadow-sm p-5">
              <h2 className="font-display text-[15px] font-bold text-ink mb-3">Your report</h2>
              <dl className="divide-y divide-line">
                <div className="flex gap-4 py-2.5">
                  <dt className="w-24 shrink-0 text-[12px] uppercase tracking-wide text-ink-faint">Problem</dt>
                  <dd className="text-[13.5px] text-ink-body leading-relaxed">{description.trim()}</dd>
                </div>
                <div className="flex gap-4 py-2.5">
                  <dt className="w-24 shrink-0 text-[12px] uppercase tracking-wide text-ink-faint">Where</dt>
                  <dd className="text-[13.5px] text-ink-body">{address.trim() || '—'}</dd>
                </div>
                <div className="flex gap-4 py-2.5">
                  <dt className="w-24 shrink-0 text-[12px] uppercase tracking-wide text-ink-faint">Photos</dt>
                  <dd className="text-[13.5px] text-ink-body">
                    {photos.length ? `${photos.length} attached` : 'None'}
                  </dd>
                </div>
              </dl>
              <p className="text-[12px] text-ink-faint mt-3 leading-relaxed">
                Once filed you will get a reference number and a date it is due by, set from how
                urgent the problem is.
              </p>
            </section>
          </div>
        )}

        {/* ── Navigation ────────────────────────────────────────── */}
        <div className="flex items-center gap-3 flex-wrap">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((n) => n - 1)}
              className="focus-ring bg-surface border border-line hover:border-civic-400 text-ink-body font-semibold text-[14px] px-5 py-2.5 rounded-xl transition-colors"
            >
              Back
            </button>
          )}

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep((n) => n + 1)}
              disabled={Boolean(blocking)}
              className="focus-ring lift inline-flex items-center gap-2 bg-civic-800 hover:enabled:bg-civic-900 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-[14px] px-5 py-2.5 rounded-xl shadow-sm transition-all"
            >
              Continue
            </button>
          ) : (
            <button
              type="submit"
              disabled={loading || Boolean(blocking)}
              className="focus-ring lift inline-flex items-center gap-2 bg-civic-800 hover:enabled:bg-civic-900 disabled:opacity-50 disabled:cursor-not-allowed text-white font-display font-bold text-[15px] px-6 py-3 rounded-xl shadow-md transition-all"
            >
              <IconSend size={16} /> {loading ? 'Filing…' : 'File this report'}
            </button>
          )}

          {/* Say what is missing rather than leaving a dead button. */}
          {blocking && (
            <span className="text-[12.5px] text-ink-muted">{blocking}</span>
          )}
        </div>
      </form>

      <p className="text-[12.5px] text-ink-faint mt-6">
        Changed your mind?{' '}
        <Link to="/complaints" className="focus-ring rounded font-semibold text-civic-700 hover:underline">
          See your existing complaints
        </Link>
      </p>
    </div>
  );
}
