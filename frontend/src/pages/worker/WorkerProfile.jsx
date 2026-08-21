// Field worker profile.
//
// This used to be read-only plus an availability toggle, and it could not even
// show the current availability: PATCH /workers/me/availability returned the
// new value but nothing could read one back, so the page guessed "not confirmed
// yet" every load. GET /workers/me/profile now returns the whole record, so the
// guessing is gone.
//
// Two things a worker can now set that the rest of the app depends on:
//
//   base address     where they start from, for dispatch
//   current location the point "nearest first" measures their task list against
//
// The location is stored with the time it was recorded. A position with no
// timestamp cannot be told apart from one taken three days ago, and ordering a
// shift around a stale fix is worse than not ordering it at all.
import React, { useCallback, useEffect, useState } from 'react';
import { IconMail, IconShieldCheck } from '../../components/icons';
import {
  IconCheckCircle, IconMapPin, IconCrosshair, IconClock, IconAlertTriangle,
} from '../../components/dashboard/icons';
import { LoadingPanel, ErrorPanel } from '../../components/dashboard/AsyncStates';
import { getMyWorkerProfile, updateMyWorkerProfile, setMyAvailability } from '../../api/workers';
import { reverseGeocode } from '../../api/geocode';
import { parseSkills } from '../../lib/skills';
import useAsync from '../../hooks/useAsync';

// Past this, a stored position is more likely to mislead than help.
const STALE_AFTER_HOURS = 12;

function Row({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3.5 py-3.5">
      <span className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
        <Icon size={17} />
      </span>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
        <div className="text-[14px] font-medium text-slate-800 truncate">{value}</div>
      </div>
    </div>
  );
}

function hoursSince(iso) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / 3600000;
}

function agoLabel(iso) {
  const h = hoursSince(iso);
  if (h === null) return null;
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min ago`;
  if (h < 48) return `${Math.round(h)} hour${Math.round(h) === 1 ? '' : 's'} ago`;
  return `${Math.round(h / 24)} days ago`;
}

export default function WorkerProfile() {
  const { data, error, loading, refetch, setData } = useAsync(() => getMyWorkerProfile(), []);

  const [form, setForm] = useState({ name: '', phone: '', baseAddress: '' });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState('');

  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState('');
  const [nearby, setNearby] = useState('');

  const [busyAvail, setBusyAvail] = useState(false);

  // Seed the form once the record lands. Guarded on `dirty` so a background
  // refetch cannot overwrite what the worker is halfway through typing.
  useEffect(() => {
    if (!data || dirty) return;
    setForm({
      name: data.name || '',
      phone: data.phone || '',
      baseAddress: data.baseAddress || '',
    });
  }, [data, dirty]);

  // A stored coordinate pair means nothing to a person. Turn it into a place
  // name where possible, and say so plainly when the lookup fails rather than
  // showing raw decimals as if they were an address.
  useEffect(() => {
    if (!data?.currentLatitude || !data?.currentLongitude) { setNearby(''); return; }
    let alive = true;
    reverseGeocode({ latitude: data.currentLatitude, longitude: data.currentLongitude })
      .then((a) => { if (alive) setNearby(a || ''); })
      .catch(() => { if (alive) setNearby(''); });
    return () => { alive = false; };
  }, [data]);

  const set = (key) => (e) => {
    setDirty(true);
    setSaved('');
    setForm((f) => ({ ...f, [key]: e.target.value }));
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError('');
    try {
      const updated = await updateMyWorkerProfile({
        name: form.name.trim(),
        phone: form.phone.trim(),
        baseAddress: form.baseAddress.trim(),
      });
      setData(updated);
      setDirty(false);
      setSaved('Saved.');
    } catch (err) {
      if (err.name !== 'SessionExpiredError') setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const shareLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocateError('This device cannot report a location.');
      return;
    }
    setLocating(true);
    setLocateError('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const updated = await updateMyWorkerProfile({
            coords: { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
          });
          setData(updated);
          setSaved('Location updated.');
        } catch (err) {
          if (err.name !== 'SessionExpiredError') setLocateError(err.message);
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        setLocateError(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission is off. Allow it in your browser to share your position.'
            : 'Could not get a location fix.',
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }, [setData]);

  const setAvailability = async (available) => {
    setBusyAvail(true);
    setSaveError('');
    try {
      const result = await setMyAvailability(available);
      setData((prev) => ({ ...(prev || {}), availabilityStatus: result.availabilityStatus }));
    } catch (err) {
      if (err.name !== 'SessionExpiredError') setSaveError(err.message);
    } finally {
      setBusyAvail(false);
    }
  };

  if (loading) {
    return <div className="max-w-[640px] mx-auto"><LoadingPanel label="Loading your profile…" variant="detail" /></div>;
  }
  if (error) {
    return <div className="max-w-[640px] mx-auto"><ErrorPanel error={error} onRetry={refetch} /></div>;
  }

  const skills = parseSkills(data?.skillSet);
  const hasLocation = data?.currentLatitude != null && data?.currentLongitude != null;
  const staleHours = data?.locationUpdatedAt ? hoursSince(data.locationUpdatedAt) : null;
  const stale = staleHours !== null && staleHours > STALE_AFTER_HOURS;
  const available = data?.availabilityStatus === 'AVAILABLE';

  return (
    <div className="max-w-[640px] mx-auto space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Profile</h1>
        <p className="text-[14px] text-slate-500">Your details, where you work from, and availability.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-4 pb-5 border-b border-slate-100">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-display font-bold text-xl shrink-0">
            {(data?.name || '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="font-display font-bold text-slate-900 text-[17px] truncate">{data?.name || 'Unknown'}</div>
            <span className="inline-block mt-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700">
              Field Worker
            </span>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          <Row icon={IconMail} label="Email" value={data?.email || '—'} />
          <Row icon={IconShieldCheck} label="User ID" value={data?.userId || '—'} />
        </div>

        {/* Skills are shown, not editable: what you are qualified for decides
            what you can be assigned, so it stays an administrator's call. */}
        <div className="pt-4 border-t border-slate-100">
          <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-2">Skills</div>
          {skills.length === 0 ? (
            <p className="text-[13px] text-slate-500">
              None recorded. Ask an administrator to set these — without them you will not be
              offered work.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {skills.map((s) => (
                <span key={s} className="px-2 py-0.5 rounded-md text-[12px] font-medium bg-slate-100 text-slate-700">
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Editable details */}
      <form onSubmit={save} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <h2 className="font-semibold text-slate-800 text-[15px]">Your details</h2>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1" htmlFor="wp-name">
            Full name
          </label>
          <input
            id="wp-name"
            value={form.name}
            onChange={set('name')}
            className="w-full bg-white rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-800 outline-none focus:border-primary transition"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1" htmlFor="wp-phone">
            Phone
          </label>
          <input
            id="wp-phone"
            value={form.phone}
            onChange={set('phone')}
            className="w-full bg-white rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-800 outline-none focus:border-primary transition"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1" htmlFor="wp-addr">
            Base address
          </label>
          <input
            id="wp-addr"
            value={form.baseAddress}
            onChange={set('baseAddress')}
            placeholder="Depot or ward office you work out of"
            className="w-full bg-white rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-800 outline-none focus:border-primary transition"
          />
          <p className="text-[11px] text-slate-400 mt-1">
            Where you start from. This does not move — your live position is separate, below.
          </p>
        </div>

        {saveError && <p className="text-[13px] font-medium text-red-600">{saveError}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving || !dirty}
            className="px-4 py-2 rounded-lg text-[13px] font-semibold bg-primary hover:bg-leaf-700 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
          >
            {saving ? 'Saving…' : 'Save details'}
          </button>
          {saved && (
            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-emerald-700">
              <IconCheckCircle size={14} /> {saved}
            </span>
          )}
        </div>
      </form>

      {/* Current position */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-3">
        <h2 className="font-semibold text-slate-800 text-[15px]">Current location</h2>
        <p className="text-[13px] text-slate-500">
          Shared once when you press the button — not tracked in the background. It is what
          “nearest first” measures your task list against.
        </p>

        {hasLocation ? (
          <div className={`rounded-xl border px-3.5 py-3 ${stale ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
            <div className="flex items-start gap-2.5">
              <IconMapPin size={16} className={stale ? 'text-amber-600 mt-0.5' : 'text-primary mt-0.5'} />
              <div className="min-w-0">
                <div className="text-[13.5px] font-medium text-slate-800">
                  {nearby || `${data.currentLatitude.toFixed(4)}, ${data.currentLongitude.toFixed(4)}`}
                </div>
                {data.locationUpdatedAt && (
                  <div className="flex items-center gap-1.5 text-[11.5px] text-slate-500 mt-0.5">
                    <IconClock size={11} /> updated {agoLabel(data.locationUpdatedAt)}
                  </div>
                )}
                {stale && (
                  <div className="flex items-start gap-1.5 text-[11.5px] text-amber-800 mt-1.5">
                    <IconAlertTriangle size={11} className="shrink-0 mt-0.5" />
                    <span>
                      This is more than half a day old. Share it again before ordering your tasks
                      by distance, or they will be sorted around where you used to be.
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-[13px] text-slate-500 bg-slate-50 rounded-xl px-3.5 py-3">
            No position shared yet, so your tasks can only be ordered by urgency.
          </p>
        )}

        {locateError && <p className="text-[13px] font-medium text-red-600">{locateError}</p>}

        <button
          onClick={shareLocation}
          disabled={locating}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-700 transition-colors"
        >
          <IconCrosshair size={14} className={locating ? 'animate-spin-slow' : ''} />
          {locating ? 'Getting a fix…' : hasLocation ? 'Update my location' : 'Share my location'}
        </button>
      </div>

      {/* Availability — now read back from the record rather than guessed. */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-3">
        <h2 className="font-semibold text-slate-800 text-[15px]">Availability</h2>
        <p className="text-[13px]">
          {available ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
              <IconCheckCircle size={14} /> Available for work
            </span>
          ) : (
            <span className="text-slate-500 font-medium">Off duty</span>
          )}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setAvailability(true)}
            disabled={busyAvail || available}
            className="px-4 py-2 rounded-lg text-[13px] font-semibold bg-emerald-500 hover:bg-leaf-700 disabled:opacity-50 text-white transition-colors"
          >
            Available
          </button>
          <button
            onClick={() => setAvailability(false)}
            disabled={busyAvail || !available}
            className="px-4 py-2 rounded-lg text-[13px] font-semibold bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-600 transition-colors"
          >
            Off Duty
          </button>
        </div>
      </div>
    </div>
  );
}
