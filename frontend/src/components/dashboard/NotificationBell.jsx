// Notification bell for the top bar, for every role.
//
// The backend's /notifications/me now resolves the recipient from an explicit
// recipientId rather than joining through complaint.citizenId, so officers,
// field workers and admins all receive notifications too — one widget serves
// all four roles.
//
// This replaces the Notifications sidebar entry. Notifications are an
// interruption you check in passing, not a place you navigate to and stay; a
// nav row also cost admins nothing, since they never had one at all.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  IconBell, IconCheckCircle, IconClock, IconInbox, IconAlertTriangle, IconArrowRight,
} from './icons';
import {
  listMyNotifications, getUnreadCount, markNotificationRead, markAllNotificationsRead,
} from '../../api/notifications';

const TYPE_META = {
  status: { icon: IconClock, tone: 'bg-blue-50 text-blue-600' },
  assigned: { icon: IconInbox, tone: 'bg-amber-50 text-amber-600' },
  resolved: { icon: IconCheckCircle, tone: 'bg-emerald-50 text-emerald-600' },
  rejected: { icon: IconAlertTriangle, tone: 'bg-red-50 text-red-600' },
};

function relativeTime(iso) {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';
  const mins = Math.round((Date.now() - then.getTime()) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.round(hrs / 24);
  if (days < 8) return `${days}d`;
  return then.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

// How often to re-check the unread count. 60s is a compromise: often enough
// that a badge is not stale for long, rare enough that it is not a load
// concern. The endpoint returns a single integer, not the list.
const POLL_MS = 60000;

export default function NotificationBell({ viewAllHref = '/notifications' }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const wrapRef = useRef(null);

  const refreshCount = useCallback(async () => {
    try {
      setUnread(await getUnreadCount());
    } catch {
      // A failing badge should stay silent — it is ambient, and an error toast
      // for it would interrupt whatever the user is actually doing.
    }
  }, []);

  useEffect(() => {
    refreshCount();
    const t = setInterval(refreshCount, POLL_MS);
    return () => clearInterval(t);
  }, [refreshCount]);

  // The list is only fetched when the panel opens.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    setError('');
    listMyNotifications({ limit: 8 })
      .then((list) => alive && setItems(list))
      .catch((err) => {
        if (alive && err.name !== 'SessionExpiredError') setError(err.message);
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [open]);

  // Close on outside click and on Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Optimistic: flip locally, then persist. Rolling back silently would look
  // like the click did nothing, so a failure restores the row and surfaces.
  const markOne = async (n) => {
    if (n.isRead) return;
    setItems((l) => l.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
    setUnread((u) => Math.max(0, u - 1));
    try {
      await markNotificationRead(n.id);
    } catch (err) {
      if (err.name === 'SessionExpiredError') return;
      setItems((l) => l.map((x) => (x.id === n.id ? { ...x, isRead: false } : x)));
      setUnread((u) => u + 1);
      setError(err.message);
    }
  };

  const markAll = async () => {
    const prev = items;
    const prevUnread = unread;
    setItems((l) => l.map((x) => ({ ...x, isRead: true })));
    setUnread(0);
    try {
      await markAllNotificationsRead();
    } catch (err) {
      if (err.name === 'SessionExpiredError') return;
      setItems(prev);
      setUnread(prevUnread);
      setError(err.message);
    }
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        className={`focus-ring relative p-2 rounded-lg transition-colors ${
          open ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
        }`}
      >
        <IconBell size={20} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center tnum">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-full mt-2 w-[min(380px,calc(100vw-2rem))] bg-white rounded-2xl border border-line shadow-xl overflow-hidden animate-scale-in origin-top-right z-50"
        >
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-line bg-slate-50">
            <span className="text-[14px] font-semibold text-ink">Notifications</span>
            {unread > 0 && (
              <button onClick={markAll} className="focus-ring text-[12px] font-semibold text-primary hover:underline">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[380px] overflow-y-auto">
            {error && (
              <p className="text-[12px] text-red-700 bg-red-50 border-b border-red-100 px-4 py-2">{error}</p>
            )}

            {loading ? (
              <div className="p-4 space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="skeleton animate-shimmer w-9 h-9 rounded-xl shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="skeleton animate-shimmer h-3 w-3/4" />
                      <div className="skeleton animate-shimmer h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <div className="w-11 h-11 rounded-2xl bg-slate-100 text-ink-faint flex items-center justify-center mx-auto mb-3">
                  <IconBell size={20} />
                </div>
                <p className="text-[13px] text-ink-muted">Nothing yet.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {items.map((n) => {
                  const { icon: Icon, tone } = TYPE_META[n.type] || TYPE_META.status;
                  return (
                    <li key={n.id} className={n.isRead ? '' : 'bg-emerald-50/40'}>
                      <Link
                        to={n.complaintId ? `/complaints/${n.complaintId}` : viewAllHref}
                        onClick={() => { markOne(n); setOpen(false); }}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
                      >
                        <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${tone}`}>
                          <Icon size={17} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] text-ink-body leading-snug">{n.message}</p>
                          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-ink-faint">
                            {n.complaintId && <span className="font-mono">{n.complaintId}</span>}
                            {n.complaintId && <span>·</span>}
                            <span>{relativeTime(n.sentAt)}</span>
                          </div>
                        </div>
                        {!n.isRead && <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" aria-label="Unread" />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <Link
            to={viewAllHref}
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 border-t border-line text-[13px] font-semibold text-primary hover:bg-slate-50 transition-colors"
          >
            View all <IconArrowRight size={14} />
          </Link>
        </div>
      )}
    </div>
  );
}
