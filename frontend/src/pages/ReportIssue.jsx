// Report an Issue — lets a citizen file a new complaint: pick a category,
// describe it, attach a photo, set the location, and submit.
// The "AI Prediction" block is a front-end preview only (mock) until Raja's
// backend exposes a real classifier.
import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconAlertTriangle, IconTrash, IconDroplet, IconBulb, IconMoreHorizontal,
  IconUpload, IconX, IconMapPin, IconCrosshair, IconSparkles, IconSend,
} from '../components/dashboard/icons';
import { createComplaint } from '../api/complaints';

// Category options with the icon + a default AI-predicted severity used by the
// preview. `value` is what we send to the backend.
const CATEGORIES = [
  { value: 'pothole', label: 'Pothole', icon: IconAlertTriangle, severity: 'High' },
  { value: 'garbage', label: 'Garbage', icon: IconTrash, severity: 'Medium' },
  { value: 'water_leakage', label: 'Water Leakage', icon: IconDroplet, severity: 'High' },
  { value: 'streetlight', label: 'Streetlight', icon: IconBulb, severity: 'Low' },
  { value: 'other', label: 'Other', icon: IconMoreHorizontal, severity: 'Medium' },
];

const SEVERITY_STYLES = {
  Low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Medium: 'bg-amber-50 text-amber-700 border-amber-200',
  High: 'bg-red-50 text-red-700 border-red-200',
  Critical: 'bg-red-100 text-red-800 border-red-300',
};

const MAX_IMAGE_MB = 5;

export default function ReportIssue() {
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('MG Road, City');
  const [image, setImage] = useState(null); // File
  const [preview, setPreview] = useState(''); // object URL
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  const selected = CATEGORIES.find((c) => c.value === category);

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

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setMessage({ text: 'Geolocation is not supported by this browser.', type: 'error' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation(`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`),
      () => setMessage({ text: 'Could not get your location. Please enter it manually.', type: 'error' }),
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!category) return setMessage({ text: 'Please select an issue category.', type: 'error' });
    if (!description.trim()) return setMessage({ text: 'Please describe the issue.', type: 'error' });
    if (!location.trim()) return setMessage({ text: 'Please provide a location.', type: 'error' });

    setMessage({ text: '', type: '' });
    setLoading(true);
    try {
      await createComplaint({
        category,
        description: description.trim(),
        location: location.trim(),
        severity: selected?.severity || 'Medium',
        image,
      });
      setMessage({ text: 'Complaint submitted successfully! Redirecting…', type: 'success' });
      setTimeout(() => navigate('/my-complaints'), 1500);
    } catch (err) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[760px] mx-auto">
      <h1 className="font-display text-2xl font-bold text-slate-900 mb-1">Report an Issue</h1>
      <p className="text-[14px] text-slate-500 mb-6">Tell us what's wrong and where — we'll route it to the right team.</p>

      {message.text && (
        <div
          className={`mb-5 px-4 py-3 rounded-xl text-[13px] font-medium border ${
            message.type === 'error'
              ? 'bg-red-50 text-red-700 border-red-200'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-7">
        {/* 1. Category */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="font-semibold text-slate-800 text-[15px]">1. Select Issue Category</h2>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary bg-emerald-50 px-2 py-0.5 rounded-full">
              <IconSparkles size={12} /> AI Auto-Detect
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {CATEGORIES.map(({ value, label, icon: Icon }) => {
              const active = category === value;
              return (
                <button
                  type="button"
                  key={value}
                  onClick={() => setCategory(value)}
                  className={`flex flex-col items-center gap-2 py-4 px-2 rounded-xl border text-[13px] font-medium transition-colors ${
                    active
                      ? 'border-primary bg-emerald-50 text-primary'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <Icon size={22} />
                  {label}
                </button>
              );
            })}
          </div>
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
          <h2 className="font-semibold text-slate-800 text-[15px] mb-3">3. Upload Image</h2>
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
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Enter the location"
              className="flex-1 py-3 text-[14px] text-slate-800 outline-none bg-transparent"
            />
            <button
              type="button"
              onClick={useCurrentLocation}
              className="shrink-0 inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline"
            >
              <IconCrosshair size={14} /> Use Current Location
            </button>
          </div>
        </section>

        {/* 5. AI Prediction (preview only) */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="font-semibold text-slate-800 text-[15px]">5. AI Prediction</h2>
            <span className="text-[11px] font-medium text-slate-400">(Preview)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="text-[12px] text-slate-400 mb-1">Predicted Category</div>
              <div className="font-semibold text-slate-800">{selected ? selected.label : '—'}</div>
              <div className="text-[12px] text-slate-400 mt-1">
                {selected ? 'Confidence: 92%' : 'Select a category above'}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="text-[12px] text-slate-400 mb-1">Severity Level</div>
              {selected ? (
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[13px] font-semibold ${SEVERITY_STYLES[selected.severity]}`}>
                  <IconAlertTriangle size={14} /> {selected.severity}
                </span>
              ) : (
                <div className="font-semibold text-slate-800">—</div>
              )}
            </div>
          </div>
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
