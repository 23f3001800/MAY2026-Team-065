// Nearby Issues — what has already been reported around the citizen, so they
// can check before filing a duplicate. Filterable by radius and category.
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import StatusBadge from '../components/dashboard/StatusBadge';
import SeverityBadge from '../components/dashboard/SeverityBadge';
import {
  IconMapPin, IconCrosshair, IconSearch, IconChevronDown,
  IconUsers, IconReport, IconArrowRight,
} from '../components/dashboard/icons';
import { nearbyIssues, RADIUS_OPTIONS } from '../data/mockNearby';
import { CATEGORY_FILTERS } from '../data/mockComplaints';

function formatDate(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export default function NearbyIssues() {
  const [area, setArea] = useState('MG Road, City');
  const [radius, setRadius] = useState(2);
  const [category, setCategory] = useState('All');
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState('');

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setNotice('Geolocation is not supported by this browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setArea(`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);
        setNotice('');
        setLocating(false);
      },
      () => {
        setNotice('Could not get your location. Enter an area manually.');
        setLocating(false);
      },
    );
  };

  const filtered = useMemo(
    () =>
      nearbyIssues
        .filter((i) => i.distanceKm <= radius && (category === 'All' || i.category === category))
        .sort((a, b) => a.distanceKm - b.distanceKm),
    [radius, category],
  );

  return (
    <div className="max-w-[1000px] mx-auto space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Nearby Issues</h1>
        <p className="text-[14px] text-slate-500">
          Check what neighbours have already reported before filing a new complaint.
        </p>
      </div>

      {/* Area + radius controls */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-emerald-100 transition">
          <IconMapPin size={18} className="text-primary shrink-0" />
          <input
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="Enter an area"
            aria-label="Area"
            className="flex-1 py-3 text-[14px] text-slate-800 outline-none bg-transparent"
          />
          <button
            type="button"
            onClick={useCurrentLocation}
            disabled={locating}
            className="shrink-0 inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline disabled:opacity-60"
          >
            <IconCrosshair size={14} /> {locating ? 'Locating…' : 'Use Current Location'}
          </button>
        </div>

        {notice && <p className="text-[13px] font-medium text-amber-700">{notice}</p>}

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
              {CATEGORY_FILTERS.map((c) => (
                <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>
              ))}
            </select>
            <IconChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-4">
            <IconSearch size={26} />
          </div>
          <h2 className="font-display font-bold text-slate-800 text-lg">Nothing reported here yet</h2>
          <p className="text-[14px] text-slate-500 mt-1 max-w-sm">
            No open complaints within {radius} km. If you have spotted something, be the first to report it.
          </p>
          <Link
            to="/report"
            className="mt-5 inline-flex items-center gap-2 bg-primary hover:bg-emerald-600 text-white font-semibold text-[14px] px-4 py-2.5 rounded-xl shadow-btn transition-colors"
          >
            <IconReport size={16} /> Report Issue
          </Link>
        </div>
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
                    <span className="text-slate-300">·</span>
                    <span className="font-medium text-primary whitespace-nowrap">{i.distanceKm} km</span>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <SeverityBadge severity={i.severity} />
                    <span className="inline-flex items-center gap-1.5 text-[12px] text-slate-500">
                      <IconUsers size={13} className="text-slate-400" />
                      {i.reportCount} report{i.reportCount > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="text-[12px] text-slate-400 mt-2">Reported {formatDate(i.date)}</div>
                </Link>
              </li>
            ))}
          </ul>

          {/* Nudge toward reporting only if it is genuinely new. */}
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
