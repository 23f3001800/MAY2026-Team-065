// Nearby Issues — what has already been reported around the citizen, so they
// can check before filing a duplicate.
//
// Backed by GET /complaints/nearby?latitude&longitude&radius_km, which needs
// real coordinates, so the page asks for the browser's location first. The
// endpoint runs a bounding-box query and returns no distance, so distance is
// computed here from the coordinates it does return.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import StatusBadge from '../components/dashboard/StatusBadge';
import SeverityBadge from '../components/dashboard/SeverityBadge';
import { LoadingPanel, ErrorPanel, EmptyPanel } from '../components/dashboard/AsyncStates';
import {
  IconMapPin, IconCrosshair, IconSearch, IconChevronDown, IconReport, IconArrowRight,
} from '../components/dashboard/icons';
import { RADIUS_OPTIONS } from '../data/filters';
import { CATEGORIES } from '../api/mappers';
import { listNearbyComplaints } from '../api/complaints';

function formatDate(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

// Great-circle distance in km. The backend filters by a square bounding box, so
// results can sit slightly outside the requested radius; this is what lets us
// sort sensibly and drop the corners.
function distanceKm(a, b) {
  if (!a || !b) return null;
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

const CATEGORY_FILTER_OPTIONS = ['All', ...CATEGORIES.map((c) => c.label)];

export default function NearbyIssues() {
  const [origin, setOrigin] = useState(null);      // { latitude, longitude }
  const [locating, setLocating] = useState(true);
  const [locationError, setLocationError] = useState('');

  const [radius, setRadius] = useState(2);
  const [category, setCategory] = useState('All');

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('This browser cannot share your location, so nearby issues are unavailable.');
      setLocating(false);
      return;
    }
    setLocating(true);
    setLocationError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setLocating(false);
      },
      (err) => {
        setLocationError(
          err.code === err.PERMISSION_DENIED
            ? 'Location access was denied. Allow it in your browser to see what has been reported near you.'
            : 'Could not determine your location. Try again in a moment.',
        );
        setLocating(false);
      },
      { timeout: 10000 },
    );
  }, []);

  useEffect(() => { requestLocation(); }, [requestLocation]);

  // Refetch whenever the origin or radius changes. Category is filtered
  // client-side since the endpoint takes no category parameter.
  const load = useCallback(async () => {
    if (!origin) return;
    setLoading(true);
    setError('');
    try {
      const data = await listNearbyComplaints({ ...origin, radiusKm: radius });
      setResults(data);
    } catch (err) {
      if (err.name !== 'SessionExpiredError') setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [origin, radius]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    return results
      .map((c) => ({ ...c, distanceKm: distanceKm(origin, c.coords) }))
      // Bounding box includes corners beyond the radius — drop them.
      .filter((c) => c.distanceKm === null || c.distanceKm <= radius)
      .filter((c) => category === 'All' || c.category === category)
      .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  }, [results, origin, radius, category]);

  return (
    <div className="max-w-[1000px] mx-auto space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Nearby Issues</h1>
        <p className="text-[14px] text-slate-500">
          Check what neighbours have already reported before filing a new complaint.
        </p>
      </div>

      {/* Location + radius controls */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <IconMapPin size={18} className="text-primary shrink-0" />
          <span className="text-[14px] text-slate-700">
            {origin
              ? `Searching around ${origin.latitude.toFixed(4)}, ${origin.longitude.toFixed(4)}`
              : 'Location not set'}
          </span>
          <button
            type="button"
            onClick={requestLocation}
            disabled={locating}
            className="ml-auto shrink-0 inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline disabled:opacity-60"
          >
            <IconCrosshair size={14} /> {locating ? 'Locating…' : 'Update location'}
          </button>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-slate-400">Within</span>
            {RADIUS_OPTIONS.map((r) => (
              <button
                key={r}
                onClick={() => setRadius(r)}
                className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
                  radius === r ? 'bg-primary text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {r} km
              </button>
            ))}
          </div>
          <div className="relative ml-auto">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Category"
              className="appearance-none bg-white rounded-xl border border-slate-200 pl-3.5 pr-9 py-2 text-[14px] text-slate-700 outline-none focus:border-primary cursor-pointer"
            >
              {CATEGORY_FILTER_OPTIONS.map((c) => (
                <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>
              ))}
            </select>
            <IconChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Results */}
      {locating ? (
        <LoadingPanel label="Finding your location…" />
      ) : locationError ? (
        <ErrorPanel error={locationError} onRetry={requestLocation} />
      ) : loading ? (
        <LoadingPanel label="Looking for nearby complaints…" variant="cards" />
      ) : error ? (
        <ErrorPanel error={error} onRetry={load} />
      ) : filtered.length === 0 ? (
        <EmptyPanel
          icon={IconSearch}
          title="Nothing reported here yet"
          message={`No complaints within ${radius} km. If you have spotted something, be the first to report it.`}
        >
          <Link
            to="/report"
            className="inline-flex items-center gap-2 bg-primary hover:bg-emerald-600 text-white font-semibold text-[14px] px-4 py-2.5 rounded-xl shadow-btn transition-colors"
          >
            <IconReport size={16} /> Report Issue
          </Link>
        </EmptyPanel>
      ) : (
        <>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filtered.map((i) => (
              <li key={i.id}>
                <Link
                  to={`/complaints/${i.id}`}
                  className="block h-full bg-white rounded-2xl border border-slate-200 shadow-sm p-4 hover:border-primary hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-[14px] font-semibold text-slate-800 leading-snug">{i.issue}</h3>
                    <StatusBadge status={i.status} />
                  </div>
                  <div className="flex items-center gap-1.5 text-[12px] text-slate-500 mt-2">
                    <IconMapPin size={13} className="text-slate-400 shrink-0" />
                    <span className="truncate">{i.location}</span>
                    {i.distanceKm !== null && (
                      <>
                        <span className="text-slate-300">·</span>
                        <span className="font-medium text-primary whitespace-nowrap">
                          {i.distanceKm < 1
                            ? `${Math.round(i.distanceKm * 1000)} m`
                            : `${i.distanceKm.toFixed(1)} km`}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <SeverityBadge severity={i.severity} />
                    <span className="text-[12px] text-slate-400">{i.category}</span>
                  </div>
                  <div className="text-[12px] text-slate-400 mt-2">Reported {formatDate(i.date)}</div>
                </Link>
              </li>
            ))}
          </ul>

          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[13px] text-emerald-900">
              Don't see your issue in this list? Report it and we'll route it to the right team.
            </p>
            <Link
              to="/report"
              className="inline-flex items-center gap-2 bg-primary hover:bg-emerald-600 text-white font-semibold text-[13px] px-3.5 py-2 rounded-lg shadow-btn transition-colors whitespace-nowrap"
            >
              Report Issue <IconArrowRight size={15} />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
