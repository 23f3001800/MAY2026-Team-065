// Notifications — every status change on the citizen's complaints, newest
// first, with unread filtering.
//
// Backed by GET /notifications/me. Read state now persists via
// PATCH /notifications/{id}/read and POST /notifications/me/read-all, applied
// optimistically and rolled back if the write fails.
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LoadingPanel, ErrorPanel, EmptyPanel } from '../components/dashboard/AsyncStates';
import {
  IconBell, IconCheckCircle, IconClock, IconInbox, IconAlertTriangle, IconArrowRight,
} from '../components/dashboard/icons';
import { NOTIFICATION_FILTERS } from '../data/filters';
import Toast from '../components/dashboard/Toast';
import { listMyNotifications, markNotificationRead, markAllNotificationsRead } from '../api/notifications';
import useAsync from '../hooks/useAsync';

// Icon + accent per notification type.
const TYPE_META = {
  status: { icon: IconClock, tone: 'bg-blue-50 text-blue-600' },
  assigned: { icon: IconInbox, tone: 'bg-amber-50 text-amber-600' },
  resolved: { icon: IconCheckCircle, tone: 'bg-emerald-50 text-emerald-600' },
  rejected: { icon: IconAlertTriangle, tone: 'bg-red-50 text-red-600' },
};

// "2 hours ago" style, falling back to a date once it is over a week old.
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

export default function Notifications() {
  const { data, error, loading, refetch } = useAsync(() => listMyNotifications(), []);
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('All');
  const [writeError, setWriteError] = useState('');

  // Mirror fetched data into local state so read toggles can be applied
  // optimistically without a refetch.
  useEffect(() => { setItems(data || []); }, [data]);

  const unread = items.filter((n) => !n.isRead).length;
  const visible = useMemo(
    () => (filter === 'Unread' ? items.filter((n) => !n.isRead) : items),
    [items, filter],
  );

  // Optimistic: flip locally first so the row responds instantly, then persist.
  // If the write fails, roll the row back and say so — silently reverting would
  // look like the click did nothing.
  const markRead = async (id) => {
    const before = items;
    setItems((list) => list.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    try {
      await markNotificationRead(id, true);
    } catch (err) {
      if (err.name === 'SessionExpiredError') return;
      setItems(before);
      setWriteError('Could not mark that as read. Please try again.');
    }
  };

  const markAllRead = async () => {
    const before = items;
    setItems((list) => list.map((n) => ({ ...n, isRead: true })));
    try {
      await markAllNotificationsRead();
    } catch (err) {
      if (err.name === 'SessionExpiredError') return;
      setItems(before);
      setWriteError('Could not mark everything as read. Please try again.');
    }
  };

  return (
    <div className="max-w-[860px] mx-auto space-y-5">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Notifications</h1>
          <p className="text-[14px] text-slate-500">
            {unread > 0 ? `You have ${unread} unread notification${unread > 1 ? 's' : ''}.` : 'You are all caught up.'}
          </p>
        </div>
        {unread > 0 && (
          <button
            onClick={markAllRead}
            className="text-[13px] font-semibold text-primary hover:underline"
          >
            Mark all as read
          </button>
        )}
      </div>

      <Toast message={writeError} tone="error" onDismiss={() => setWriteError('')} autoHideMs={0} />

      <div className="flex gap-2">
        {NOTIFICATION_FILTERS.map((f) => {
          const active = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                active ? 'bg-primary text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {f}
              {f === 'Unread' && (
                <span className={`text-[11px] font-bold px-1.5 rounded-full ${active ? 'bg-white/25' : 'bg-slate-100 text-slate-500'}`}>
                  {unread}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <LoadingPanel label="Loading notifications…" variant="cards" />
      ) : error ? (
        <ErrorPanel error={error} onRetry={refetch} />
      ) : visible.length === 0 ? (
        <EmptyPanel
          icon={IconBell}
          title={items.length === 0 ? 'No notifications yet' : 'Nothing to read'}
          message={
            items.length === 0
              ? "You'll be notified here whenever one of your complaints changes status."
              : 'You have no unread notifications right now.'
          }
        />
      ) : (
        <ul className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
          {visible.map((n) => {
            const { icon: Icon, tone } = TYPE_META[n.type] || TYPE_META.status;
            return (
              <li key={n.id} className={`relative transition-colors ${n.isRead ? '' : 'bg-emerald-50/40'}`}>
                <Link
                  to={`/complaints/${n.complaintId}`}
                  onClick={() => markRead(n.id)}
                  className="flex items-start gap-3.5 p-4 hover:bg-slate-50 transition-colors"
                >
                  <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tone}`}>
                    <Icon size={19} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-semibold text-slate-800">{n.title}</span>
                      {!n.isRead && <span className="w-2 h-2 rounded-full bg-primary shrink-0" aria-label="Unread" />}
                    </div>
                    <p className="text-[13px] text-slate-600 mt-0.5 leading-snug">{n.message}</p>
                    <div className="flex items-center gap-2 mt-1.5 text-[12px] text-slate-400">
                      <span className="font-mono">{n.complaintId}</span>
                      <span>·</span>
                      <span>{relativeTime(n.sentAt)}</span>
                    </div>
                  </div>
                  <span className="text-slate-300 self-center shrink-0"><IconArrowRight size={16} /></span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
