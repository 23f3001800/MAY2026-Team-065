// Stand-in "Notifications" page for officers and field workers.
//
// GET /notifications/me is citizen-only server-side (main.py 403s anyone
// else), and there is no other endpoint that pushes events to these two
// roles. Rather than render an empty inbox that looks broken, this derives a
// real activity feed from data the role can already fetch: complaints
// ordered by their most recent update. It is not a notification -- nothing
// here is "unread" or arrives in real time -- so it is labelled Recent
// Activity, not Notifications, and says so up front.
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import StatusBadge from '../../components/dashboard/StatusBadge';
import { LoadingPanel, ErrorPanel, EmptyPanel } from '../../components/dashboard/AsyncStates';
import UnavailableNote from '../../components/dashboard/UnavailableNote';
import { IconClock, IconInbox, IconArrowRight } from '../../components/dashboard/icons';
import useAsync from '../../hooks/useAsync';

function relativeTime(iso) {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return iso;
  const mins = Math.round((Date.now() - then.getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
  const days = Math.round(hrs / 24);
  if (days < 8) return `${days} day${days > 1 ? 's' : ''} ago`;
  return then.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * @param {Function} fetchComplaints  the role's own list call, e.g. listComplaints or listMyTasks
 * @param {string} viewHref           where "open" rows should take the user (the role's list page —
 *                                     there is no standalone complaint detail route outside /citizen)
 * @param {string} emptyMessage
 */
export default function RoleActivity({ fetchComplaints, viewHref, emptyMessage }) {
  const { data, error, loading, refetch } = useAsync(fetchComplaints, []);

  const items = useMemo(
    () => [...(data || [])].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
    [data],
  );

  return (
    <div className="max-w-[860px] mx-auto space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Recent Activity</h1>
        <p className="text-[14px] text-slate-500">The complaints you're tied to, most recently updated first.</p>
      </div>

      <UnavailableNote>
        This isn't a live notification feed — the backend doesn't push events to this role yet, only to
        citizens. What's below is your complaint list re-sorted by last update.
      </UnavailableNote>

      {loading ? (
        <LoadingPanel label="Loading recent activity…" />
      ) : error ? (
        <ErrorPanel error={error} onRetry={refetch} />
      ) : items.length === 0 ? (
        <EmptyPanel icon={IconInbox} title="Nothing yet" message={emptyMessage} />
      ) : (
        <ul className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
          {items.map((c) => (
            <li key={c.id}>
              <Link to={viewHref} className="flex items-start gap-3.5 p-4 hover:bg-slate-50 transition-colors">
                <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-blue-50 text-blue-600">
                  <IconClock size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14px] font-semibold text-slate-800">{c.issue}</span>
                    <StatusBadge status={c.status} />
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 text-[12px] text-slate-400">
                    <span className="font-mono">{c.id}</span>
                    <span>·</span>
                    <span>Updated {relativeTime(c.updatedAt)}</span>
                  </div>
                </div>
                <span className="text-slate-300 self-center shrink-0"><IconArrowRight size={16} /></span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
