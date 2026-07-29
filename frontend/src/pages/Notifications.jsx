// Notifications — every status change on the citizen's complaints, newest
// first, with unread filtering. Read state is local-only until the backend
// exposes the notifications table.
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  IconBell, IconCheckCircle, IconClock, IconInbox, IconAlertTriangle, IconArrowRight,
} from '../components/dashboard/icons';
import { notifications as seed, NOTIFICATION_FILTERS } from '../data/mockNotifications';

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
  const [items, setItems] = useState(seed);
  const [filter, setFilter] = useState('All');

  const unread = items.filter((n) => !n.isRead).length;
  const visible = useMemo(
    () => (filter === 'Unread' ? items.filter((n) => !n.isRead) : items),
    [items, filter],
  );

  const markRead = (id) =>
    setItems((list) => list.map((n) => (n.id === id ? { ...n, isRead: true } : n)));

  const markAllRead = () => setItems((list) => list.map((n) => ({ ...n, isRead: true })));

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

      {visible.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-4">
            <IconBell size={26} />
          </div>
          <h2 className="font-display font-bold text-slate-800 text-lg">Nothing to read</h2>
          <p className="text-[14px] text-slate-500 mt-1">
            You have no unread notifications right now.
          </p>
        </div>
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
