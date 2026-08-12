// What is still waiting to reach the server.
//
// The upload queue retries on its own, which is the point — but a worker who
// photographed a repair in a basement needs to know the evidence has not
// arrived yet, or they will assume it is filed and move on. Silence looks
// identical to success, and that is the one thing this must not do.
//
// Renders nothing when the queue is empty, so it costs no space on the normal
// path.
import React, { useEffect, useState } from 'react';
import { IconUpload, IconRefresh, IconAlertTriangle } from '../dashboard/icons';
import { subscribe, listPending, flush } from '../../lib/uploadQueue';

export default function PendingUploads() {
  const [pending, setPending] = useState([]);
  const [sending, setSending] = useState(false);
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine !== false,
  );

  useEffect(() => {
    let alive = true;
    listPending().then((items) => { if (alive) setPending(items); });
    const unsubscribe = subscribe((items) => { if (alive) setPending(items); });
    return () => { alive = false; unsubscribe(); };
  }, []);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  if (pending.length === 0) return null;

  // An upload that has stopped retrying needs a person, not more waiting.
  const stalled = pending.filter((p) => p.stalled);
  const photos = pending.reduce((n, p) => n + (p.files?.length || 0), 0);

  const retryNow = async () => {
    setSending(true);
    try {
      await flush();
    } finally {
      setSending(false);
    }
  };

  const tone = stalled.length
    ? 'bg-danger-50 border-danger-100 text-danger-700'
    : 'bg-caution-50 border-caution-100 text-caution-800';

  return (
    <div className={`rounded-xl border px-4 py-3 flex items-start gap-3 flex-wrap ${tone}`}>
      <span className="w-9 h-9 rounded-xl bg-surface flex items-center justify-center shrink-0">
        {stalled.length ? <IconAlertTriangle size={16} /> : <IconUpload size={16} />}
      </span>

      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-semibold">
          {pending.length} upload{pending.length === 1 ? '' : 's'} waiting
          {photos !== pending.length && ` · ${photos} photo${photos === 1 ? '' : 's'}`}
        </div>
        <p className="text-[12.5px] mt-0.5 leading-snug opacity-90">
          {stalled.length > 0
            ? `${stalled.length} stopped retrying: ${stalled[0].lastError || 'the server refused it'}. Your photos and notes are still saved on this device.`
            : online
              ? 'Saved on this device and sending automatically.'
              : 'You are offline. These will send as soon as the signal returns.'}
        </p>
      </div>

      <button
        onClick={retryNow}
        disabled={sending || !online}
        className="focus-ring shrink-0 inline-flex items-center gap-1.5 bg-surface border border-current/20 font-semibold text-[12.5px] px-3 py-1.5 rounded-lg disabled:opacity-50 transition-opacity"
      >
        <IconRefresh size={13} className={sending ? 'animate-spin-slow' : ''} />
        {sending ? 'Sending…' : 'Try now'}
      </button>
    </div>
  );
}
