// Complaints — one page for everything a citizen wants to look at.
//
// This replaces three separate nav entries: My Complaints (a table), Track
// Complaints (the same records as a lifecycle view) and Nearby Issues (other
// people's, by location). They were three routes over two queries, and a
// citizen with four complaints had to visit three pages to answer "what's
// happening with mine, and has anyone else reported this?"
//
// Two axes instead:
//   scope  mine | nearby   — whose complaints
//   view   list | map      — how to look at them
//
// Both queries stay separate at the API level (GET /complaints/ is scoped to
// the caller; /complaints/nearby takes coordinates), so nearby only loads if
// you ask for it.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import StatusBadge from '../components/dashboard/StatusBadge';
import SeverityBadge from '../components/dashboard/SeverityBadge';
import ComplaintMap from '../components/map/ComplaintMap';
import { LoadingPanel, ErrorPanel, EmptyPanel } from '../components/dashboard/AsyncStates';
import {
  IconSearch, IconChevronDown, IconReport, IconMapPin, IconCrosshair,
  IconList, IconClock, IconArrowRight,
} from '../components/dashboard/icons';
import { listComplaints, listNearbyComplaints } from '../api/complaints';
import { TERMINAL_STATUSES } from '../api/mappers';
import useCategories from '../hooks/useCategories';
import useAsync from '../hooks/useAsync';

// Wider than before. A 2km default hid most of what a citizen would consider
// "near me" in a city — the point of this view is to find an existing report
// before filing a duplicate, and that fails if the radius is too tight to
// reach it.
const RADIUS_OPTIONS = [2, 5, 10, 25];
const DAY_MS = 86400000;

function ageDays(iso) {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : Math.floor((Date.now() - t) / DAY_MS);
}

function formatDate(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

// Great-circle distance. /complaints/nearby returns no distance, so this fills
// it in for sorting and display. It does NOT filter — the backend already
// applied radius_km, and re-filtering here dropped results it had returned.
function distanceKm(a, b) {
  if (!a || !b) return null;
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2
    + Math.sin(dLon / 2) ** 2 * Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude));
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Lifecycle stages a citizen actually cares about — the ten backend states
// collapse to five here, because "On Hold" and "Escalated" both mean "still
// being worked on" from the outside.
const STAGES = ['Reported', 'Reviewed', 'Assigned', 'Fixed', 'Confirmed'];

function stageIndex(status) {
  switch (status) {
    case 'New': return 0;
    case 'Under Review': return 1;
    case 'Assigned': case 'In Progress': case 'On Hold': case 'Escalated': return 2;
    case 'Resolved': return 3;
    case 'Verified': return 4;
    case 'Rejected': case 'Reopened': return 1;
    default: return 0;
  }
}

// Compact progress rail. Gives a citizen the "where is my complaint" answer
// without opening it — the question Track Complaints existed to answer.
function Stages({ status }) {
  const current = stageIndex(status);
  const dead = status === 'Rejected';
  return (
    <div className="flex items-center gap-1 mt-2.5" title={`Stage: ${STAGES[current]}`}>
      {STAGES.map((label, i) => (
        <React.Fragment key={label}>
          <span
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              dead ? 'bg-danger-100'
                : i < current ? 'bg-teal-500'
                : i === current ? 'bg-civic-600'
                : 'bg-line'
            }`}
          />
        </React.Fragment>
      ))}
      <span className={`ml-1.5 text-[10px] font-semibold uppercase tracking-wide shrink-0 ${
        dead ? 'text-danger-600' : 'text-ink-muted'
      }`}>
        {dead ? 'Closed' : STAGES[current]}
      </span>
    </div>
  );
}

function ComplaintCard({ c, showDistance, onOpen, index }) {
  const days = ageDays(c.reportedAt);
  const open = !TERMINAL_STATUSES.includes(c.status);

  return (
    <li style={{ '--i': index }} className="animate-rise-in stagger">
      <button
        onClick={() => onOpen(c.id)}
        className="focus-ring lift w-full text-left bg-surface rounded-xl border border-line shadow-sm p-4 hover:shadow-md hover:border-civic-300 transition-all"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-semibold text-ink leading-snug">{c.issue}</h3>
            <div className="flex items-center gap-1.5 text-[12px] text-ink-muted mt-1.5">
              <IconMapPin size={12} className="text-ink-faint shrink-0" />
              <span className="truncate">{c.location}</span>
              {showDistance && c.distanceKm !== null && c.distanceKm !== undefined && (
                <>
                  <span className="text-line">·</span>
                  <span className="font-semibold text-civic-700 whitespace-nowrap">
                    {c.distanceKm < 1 ? `${Math.round(c.distanceKm * 1000)} m` : `${c.distanceKm.toFixed(1)} km`}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <StatusBadge status={c.status} />
            <SeverityBadge severity={c.severity} />
          </div>
        </div>

        {!showDistance && <Stages status={c.status} />}

        <div className="flex items-center justify-between gap-2 mt-2.5 pt-2.5 border-t border-line">
          <span className="text-[11px] font-mono text-ink-faint">{c.id}</span>
          <span className="text-[11px] text-ink-faint">
            {c.category} · {formatDate(c.reportedAt)}
            {open && days !== null && days >= 7 && (
              <span className="ml-1.5 inline-flex items-center gap-1 text-caution-700 font-semibold">
                <IconClock size={10} /> {days}d
              </span>
            )}
          </span>
        </div>
      </button>
    </li>
  );
}

export default function Complaints() {
  const navigate = useNavigate();
  const { categories } = useCategories();

  const [scope, setScope] = useState('mine');
  const [view, setView] = useState('list');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('All');
  const [category, setCategory] = useState('All');

  // Mine
  const { data, error, loading, refetch } = useAsync(() => listComplaints(), []);
  const mine = useMemo(() => data || [], [data]);

  // Nearby — only fetched when that scope is opened, so a citizen who never
  // looks at it is never asked for their location.
  const [origin, setOrigin] = useState(null);
  const [radius, setRadius] = useState(5);
  const [nearby, setNearby] = useState([]);
  const [nearbyState, setNearbyState] = useState({ loading: false, error: '' });

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setNearbyState({ loading: false, error: 'This browser cannot share your location.' });
      return;
    }
    setNearbyState({ loading: true, error: '' });
    navigator.geolocation.getCurrentPosition(
      (pos) => setOrigin({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => setNearbyState({
        loading: false,
        error: err.code === err.PERMISSION_DENIED
          ? 'Location access was denied. Allow it to see what neighbours have reported.'
          : 'Could not determine your location.',
      }),
      { timeout: 10000 },
    );
  }, []);

  useEffect(() => {
    if (scope === 'nearby' && !origin) locate();
  }, [scope, origin, locate]);

  useEffect(() => {
    if (scope !== 'nearby' || !origin) return;
    let alive = true;
    setNearbyState({ loading: true, error: '' });
    listNearbyComplaints({ ...origin, radiusKm: radius })
      .then((list) => { if (alive) { setNearby(list); setNearbyState({ loading: false, error: '' }); } })
      .catch((err) => {
        if (alive && err.name !== 'SessionExpiredError') {
          setNearbyState({ loading: false, error: err.message });
        }
      });
    return () => { alive = false; };
  }, [scope, origin, radius]);

  const statusFilters = useMemo(() => {
    const counts = { All: mine.length };
    for (const c of mine) counts[c.status] = (counts[c.status] || 0) + 1;
    return ['All', ...Object.keys(counts).filter((k) => k !== 'All')].map((k) => [k, counts[k] || 0]);
  }, [mine]);

  const rows = useMemo(() => {
    if (scope === 'nearby') {
      // Distance is for sorting and labelling ONLY — not filtering. The backend
      // already applied radius_km; re-filtering to a stricter circle here threw
      // away complaints it had legitimately returned (its bounding box is wider
      // than the circle, so corner results were silently dropped).
      return nearby
        .map((c) => ({ ...c, distanceKm: distanceKm(origin, c.coords) }))
        .filter((c) => category === 'All' || c.category === category)
        .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    }
    const q = query.trim().toLowerCase();
    return mine
      .filter((c) => (status === 'All' || c.status === status)
        && (category === 'All' || c.category === category)
        && (!q || `${c.issue} ${c.id} ${c.location}`.toLowerCase().includes(q)))
      .sort((a, b) => new Date(b.reportedAt) - new Date(a.reportedAt));
  }, [scope, nearby, origin, mine, query, status, category]);

  const busy = scope === 'mine' ? loading : nearbyState.loading;
  const failed = scope === 'mine' ? error : nearbyState.error;
  const open = mine.filter((c) => !TERMINAL_STATUSES.includes(c.status)).length;

  return (
    <div className="max-w-[1100px] mx-auto space-y-5 animate-rise-in">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-[26px] font-bold text-ink leading-tight">Complaints</h1>
          <p className="text-[14px] text-ink-muted mt-1">
            {scope === 'mine'
              ? mine.length === 0
                ? "You haven't reported anything yet."
                : `${open} of your ${mine.length} still open.`
              : 'What neighbours have reported around you.'}
          </p>
        </div>
        <Link
          to="/report"
          className="focus-ring lift inline-flex items-center gap-2 bg-civic-700 hover:bg-civic-800 text-white font-semibold text-[14px] px-4 py-2.5 rounded-xl shadow-sm transition-all"
        >
          <IconReport size={16} /> Report an issue
        </Link>
      </header>

      {/* Scope + view */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="inline-flex rounded-xl border border-line bg-surface p-1" role="tablist">
          {[['mine', 'Mine'], ['nearby', 'Nearby']].map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={scope === key}
              onClick={() => setScope(key)}
              className={`focus-ring px-4 py-2 rounded-lg text-[13px] font-semibold transition-colors ${
                scope === key ? 'bg-civic-700 text-white' : 'text-ink-body hover:bg-surface-inset'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="inline-flex rounded-lg border border-line overflow-hidden bg-surface">
          {[['list', IconList], ['map', IconMapPin]].map(([key, Icon]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              aria-pressed={view === key}
              aria-label={`${key} view`}
              className={`focus-ring px-3 py-2 transition-colors ${
                view === key ? 'bg-civic-700 text-white' : 'text-ink-muted hover:bg-surface-inset'
              }`}
            >
              <Icon size={16} />
            </button>
          ))}
        </div>
      </div>

      {/* Filters — different question per scope, so different controls. */}
      <div className="flex gap-2.5 flex-wrap">
        {scope === 'mine' ? (
          <>
            <div className="flex-1 min-w-[200px] flex items-center gap-2 bg-surface rounded-xl border border-line px-3 focus-within:border-civic-500 transition">
              <IconSearch size={17} className="text-ink-faint shrink-0" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your complaints…"
                aria-label="Search"
                className="flex-1 py-2.5 text-[14px] text-ink outline-none bg-transparent"
              />
            </div>
            <div className="flex gap-1.5 overflow-x-auto">
              {statusFilters.map(([s, n]) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`focus-ring shrink-0 inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-colors ${
                    status === s ? 'bg-civic-700 text-white' : 'bg-surface border border-line text-ink-body hover:bg-surface-inset'
                  }`}
                >
                  {s}
                  <span className={`text-[11px] font-bold tnum ${status === s ? 'opacity-75' : 'text-ink-faint'}`}>{n}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] text-ink-muted">Within</span>
              {RADIUS_OPTIONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setRadius(r)}
                  className={`focus-ring px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                    radius === r ? 'bg-civic-700 text-white' : 'bg-surface border border-line text-ink-body hover:bg-surface-inset'
                  }`}
                >
                  {r} km
                </button>
              ))}
            </div>
            <button
              onClick={locate}
              className="focus-ring inline-flex items-center gap-1.5 text-[12px] font-semibold text-civic-700 hover:underline px-2"
            >
              <IconCrosshair size={14} /> Update location
            </button>
          </>
        )}

        <div className="relative ml-auto">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Category"
            className="focus-ring appearance-none bg-surface rounded-xl border border-line pl-3.5 pr-9 py-2.5 text-[14px] text-ink-body outline-none cursor-pointer"
          >
            <option value="All">All categories</option>
            {categories.map((c) => <option key={c.categoryId} value={c.label}>{c.label}</option>)}
          </select>
          <IconChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
        </div>
      </div>

      {/* Results */}
      {busy ? (
        <LoadingPanel label={scope === 'mine' ? 'Loading your complaints…' : 'Looking around you…'} variant="cards" />
      ) : failed ? (
        <ErrorPanel error={failed} onRetry={scope === 'mine' ? refetch : locate} />
      ) : rows.length === 0 ? (
        <EmptyPanel
          title={scope === 'mine' ? 'Nothing to show' : 'Nothing reported nearby'}
          message={scope === 'mine'
            ? mine.length === 0
              ? 'When you report an issue it will appear here.'
              : 'No complaint matches these filters.'
            : `No complaints within ${radius} km. If you have spotted something, be the first.`}
        >
          <Link
            to="/report"
            className="focus-ring inline-flex items-center gap-2 bg-civic-700 hover:bg-civic-800 text-white font-semibold text-[14px] px-4 py-2.5 rounded-xl transition-colors"
          >
            <IconReport size={16} /> Report an issue
          </Link>
        </EmptyPanel>
      ) : view === 'map' ? (
        <ComplaintMap
          complaints={rows}
          height="520px"
          showMe={scope === 'nearby'}
          onSelect={(c) => navigate(`/complaints/${c.id}`)}
        />
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {rows.map((c, i) => (
            <ComplaintCard
              key={c.id}
              c={c}
              index={i}
              showDistance={scope === 'nearby'}
              onOpen={(cid) => navigate(`/complaints/${cid}`)}
            />
          ))}
        </ul>
      )}

      {!busy && !failed && rows.length > 0 && (
        <p className="text-[12px] text-ink-faint flex items-center gap-1.5 flex-wrap">
          Showing {rows.length}
          {scope === 'mine' && ` of ${mine.length}`}
          {scope === 'nearby' && ` within ${radius} km`}
          {/* A complaint with no coordinates cannot be plotted, so the map and
              the list legitimately differ. Say so rather than letting the map
              look incomplete. */}
          {view === 'map' && rows.some((c) => !c.coords) && (
            <span className="text-caution-700">
              · {rows.filter((c) => !c.coords).length} without coordinates are not on the map
            </span>
          )}
          <IconArrowRight size={11} className="text-line" />
          tap any card for the full history
        </p>
      )}
    </div>
  );
}
