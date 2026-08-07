// Report an Issue — lets a citizen file a new complaint: pick a category,
// describe it, attach a photo, set the location, and submit.
//
// Two things the backend forces on this form:
//   - POST /complaints/ needs a real latitude/longitude, so the browser's
//     location has to be captured before a complaint can be filed.
//   - The photo is a second, separate request against the new complaint id, so
//     it can fail after the complaint itself is safely saved.
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  IconAlertTriangle, IconTrash, IconDroplet, IconBulb, IconMoreHorizontal,
  IconUpload, IconX, IconMapPin, IconCrosshair, IconSparkles, IconSend,
} from '../components/dashboard/icons';
import { createComplaint } from '../api/complaints';
import { triage as runTriage } from '../api/ai';
import { CATEGORIES } from '../api/mappers';

// Icon per seeded category, keyed by the backend's categoryId.
const CATEGORY_ICONS = {
  'CAT-ROA-01': IconAlertTriangle,
  'CAT-SAN-01': IconTrash,
  'CAT-WAT-01': IconDroplet,
  'CAT-ELE-01': IconBulb,
  'CAT-PUB-01': IconMoreHorizontal,
};

const MAX_IMAGE_MB = 5;

export default function ReportIssue() {
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState(null); // { latitude, longitude }
  const [locating, setLocating] = useState(false);
  const [image, setImage] = useState(null); // File
  const [preview, setPreview] = useState(''); // object URL
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Live AI preview. Advisory only — nothing here changes what gets submitted.
  const [triage, setTriage] = useState(null);
  const [triaging, setTriaging] = useState(false);

  const selected = CATEGORIES.find((c) => c.categoryId === categoryId);

  // Top-ranked AI category suggestion, resolved to our label table.
  const suggestedCategory = (() => {
    const top = triage?.category?.suggestions?.[0];
    if (!top?.categoryId) return null;
    return CATEGORIES.find((c) => c.categoryId === top.categoryId) || null;
  })();

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

  // Ask on mount — the coordinates are mandatory, so getting the permission
  // prompt out of the way early beats failing at submit time.
  useEffect(() => { captureLocation(); }, [captureLocation]);

  // Debounced triage as the description is typed. 700ms is long enough that a
  // normal typist does not fire a request per keystroke, short enough that the
  // suggestion arrives while they are still looking at the form. Below 20
  // characters there is nothing useful to classify.
  useEffect(() => {
    const text = description.trim();
    if (text.length < 20) {
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
        if (!cancelled) setTriage(result);
      } catch {
        // A failed preview must never block filing a complaint, so this stays
        // silent — the panel simply shows nothing.
        if (!cancelled) setTriage(null);
      } finally {
        if (!cancelled) setTriaging(false);
      }
    }, 700);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [description, categoryId, coords]);

  const acceptFile = useCallback((file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMessage({ text: 'Please upload an image file (JPG or PNG).', type: 'error' });
      return;
    }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      setMessage({ text: `Image must be under ${MAX_IMAGE_MB}MB.`, type: 'error' });
      return;
    }
    setImage(file);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setMessage({ text: '', type: '' });
  }, []);

  const removeImage = () => {
    if (preview) URL.revokeObjectURL(preview);
    setImage(null);
    setPreview('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    acceptFile(e.dataTransfer.files?.[0]);
  };

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
        image,
      });

      // The complaint is filed either way; only the photo may have failed. Say
      // so, rather than reporting a clean success or a false failure.
      setMessage({
        text: imageError
          ? `Complaint ${complaint.id} was filed, but the photo did not upload (${imageError}).`
          : `Complaint ${complaint.id} submitted successfully! Redirecting…`,
        type: imageError ? 'warning' : 'success',
      });
      setTimeout(() => navigate('/my-complaints'), imageError ? 4000 : 1500);
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

  return (
    <div className="max-w-[760px] mx-auto">
      <h1 className="font-display text-2xl font-bold text-slate-900 mb-1">Report an Issue</h1>
      <p className="text-[14px] text-slate-500 mb-6">Tell us what's wrong and where — we'll route it to the right team.</p>

      {message.text && (
        <div className={`mb-5 px-4 py-3 rounded-xl text-[13px] font-medium border ${messageStyles[message.type] || messageStyles.error}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-7">
        {/* 1. Category */}
        <section>
          <h2 className="font-semibold text-slate-800 text-[15px] mb-3">1. Select Issue Category</h2>
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
                  className={`flex flex-col items-center gap-2 py-4 px-2 rounded-xl border text-[13px] font-medium transition-colors ${
                    active
                      ? 'border-primary bg-emerald-50 text-primary'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <Icon size={22} />
                  {c.label}
                </button>
              );
            })}
          </div>
          {selected && (
            <p className="text-[12px] text-slate-400 mt-2">
              Routes to the {selected.department} department.
            </p>
          )}
        </section>

        {/* 2. Description */}
        <section>
          <h2 className="font-semibold text-slate-800 text-[15px] mb-3">2. Describe the Issue</h2>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Provide details about the issue…"
            className="w-full rounded-xl border border-slate-200 p-3.5 text-[14px] text-slate-800 outline-none resize-y focus:border-primary focus:ring-2 focus:ring-emerald-100 transition"
          />
        </section>

        {/* 3. Image */}
        <section>
          <h2 className="font-semibold text-slate-800 text-[15px] mb-3">
            3. Upload Image <span className="font-normal text-slate-400 text-[13px]">(optional)</span>
          </h2>
          <div className="flex items-start gap-4 flex-wrap">
            <label
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={`flex-1 min-w-[240px] cursor-pointer rounded-xl border-2 border-dashed p-6 flex flex-col items-center justify-center text-center transition-colors ${
                dragging ? 'border-primary bg-emerald-50' : 'border-slate-300 hover:border-primary hover:bg-slate-50'
              }`}
            >
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={(e) => acceptFile(e.target.files?.[0])}
              />
              <span className="w-10 h-10 rounded-full bg-emerald-50 text-primary flex items-center justify-center mb-2">
                <IconUpload size={20} />
              </span>
              <span className="text-[13px] font-medium text-slate-700">Click to upload or drag &amp; drop</span>
              <span className="text-[12px] text-slate-400 mt-0.5">JPG, PNG up to {MAX_IMAGE_MB}MB</span>
            </label>

            {preview && (
              <div className="relative">
                <img src={preview} alt="Preview" className="w-28 h-28 object-cover rounded-xl border border-slate-200" />
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow"
                  aria-label="Remove image"
                >
                  <IconX size={14} />
                </button>
              </div>
            )}
          </div>
        </section>

        {/* 4. Location */}
        <section>
          <h2 className="font-semibold text-slate-800 text-[15px] mb-3">4. Location</h2>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-emerald-100 transition">
            <IconMapPin size={18} className="text-primary shrink-0" />
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street address or landmark"
              className="flex-1 py-3 text-[14px] text-slate-800 outline-none bg-transparent"
            />
            <button
              type="button"
              onClick={captureLocation}
              disabled={locating}
              className="shrink-0 inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline disabled:opacity-60"
            >
              <IconCrosshair size={14} /> {locating ? 'Locating…' : 'Use Current Location'}
            </button>
          </div>
          <p className={`text-[12px] mt-2 ${coords ? 'text-slate-400' : 'text-amber-700'}`}>
            {coords
              ? `GPS captured: ${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`
              : 'GPS coordinates are required — tap "Use Current Location" to capture them.'}
          </p>
        </section>

        {/* 5. AI preview — runs while you type, applies nothing */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="font-semibold text-slate-800 text-[15px]">5. AI Preview</h2>
            {triaging && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full">
                <IconSparkles size={12} className="animate-pulse-dot" /> Analysing…
              </span>
            )}
            {!triaging && triage?.source && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                <IconSparkles size={12} /> {triage.source === 'gemini' ? 'Model' : 'Rules engine'}
              </span>
            )}
          </div>

          {!triage && !triaging && (
            <p className="text-[13px] text-slate-500 leading-relaxed">
              Describe the issue above and we'll suggest a category and severity, and check whether
              it has already been reported nearby.
            </p>
          )}

          {triage && (
            <div className="space-y-3 animate-rise-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 p-3.5">
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">Suggested category</div>
                  <div className="font-semibold text-slate-800 mt-0.5">
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
                </div>
                <div className="rounded-xl border border-slate-200 p-3.5">
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">Likely severity</div>
                  <div className="font-semibold text-slate-800 mt-0.5">
                    {triage.severity?.severity
                      ? triage.severity.severity.charAt(0) + triage.severity.severity.slice(1).toLowerCase()
                      : '—'}
                  </div>
                  {triage.severity?.reason && (
                    <div className="text-[12px] text-slate-500 mt-1 leading-snug">{triage.severity.reason}</div>
                  )}
                </div>
              </div>

              {/* Duplicate warning. This is the point of running triage before
                  submit — catching a repeat costs the citizen nothing here, and
                  saves an officer a merge later. */}
              {triage.duplicates?.isDuplicate && triage.duplicates.candidates?.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5">
                  <div className="flex items-start gap-2">
                    <IconAlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-amber-900">
                        This may already have been reported
                      </div>
                      <ul className="mt-2 space-y-1.5">
                        {triage.duplicates.candidates.slice(0, 3).map((d) => (
                          <li key={d.complaintId} className="text-[12px] text-amber-900">
                            <Link
                              to={`/complaints/${d.complaintId}`}
                              className="font-mono underline hover:no-underline"
                            >
                              {d.complaintId}
                            </Link>
                            {typeof d.distanceKm === 'number' && ` · ${d.distanceKm.toFixed(1)} km away`}
                            {typeof d.similarity === 'number' && ` · ${Math.round(d.similarity * 100)}% match`}
                            {d.reason && <div className="text-amber-800/80 mt-0.5">{d.reason}</div>}
                          </li>
                        ))}
                      </ul>
                      <p className="text-[12px] text-amber-800 mt-2">
                        You can still submit — officers will merge duplicates if needed.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <p className="text-[12px] text-slate-400">
                Suggestions only. Your chosen category is what gets filed.
              </p>
            </div>
          )}
        </section>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full inline-flex items-center justify-center gap-2 bg-primary hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-[15px] py-3.5 rounded-xl shadow-btn transition-colors"
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
