// Current-area chip in the top bar.
//
// This replaces a hardcoded "MG Road, City" button that did nothing. A control
// that looks interactive and reports a fixed place is worse than no control:
// it tells the citizen the app knows where they are when it does not.
//
// It now asks the browser for a real position and reverse-geocodes it. Clicking
// re-detects. Every failure state says what happened rather than falling back
// to a plausible-looking placeholder.
import React, { useCallback, useEffect, useState } from 'react';
import { IconMapPin, IconCrosshair } from './icons';
import { reverseGeocode } from '../../api/geocode';

const STATE = {
  idle: 'idle',
  locating: 'locating',
  ready: 'ready',
  denied: 'denied',
  failed: 'failed',
};

/**
 * @param {Function} [onLocated] called with {latitude, longitude} on a fix.
 *   Best-effort by design: a field worker's chip uses this to record their
 *   position server-side, and a failure to save must not stop the chip from
 *   showing them where they are.
 */
export default function LocationChip({ onLocated }) {
  const [state, setState] = useState(STATE.idle);
  const [label, setLabel] = useState('');

  const detect = useCallback(() => {
    if (!navigator.geolocation) {
      setState(STATE.failed);
      setLabel('Location unavailable');
      return;
    }
    setState(STATE.locating);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        if (onLocated) {
          try {
            await onLocated(coords);
          } catch {
            // Reporting the position is a side benefit, not the chip's job.
          }
        }
        const address = await reverseGeocode(coords);
        setState(STATE.ready);
        // If the lookup fails we still know where they are, so show the
        // coordinates rather than pretending we found nothing.
        setLabel(address || `${coords.latitude.toFixed(3)}, ${coords.longitude.toFixed(3)}`);
      },
      (err) => {
        const denied = err.code === err.PERMISSION_DENIED;
        setState(denied ? STATE.denied : STATE.failed);
        setLabel(denied ? 'Location off' : 'Location unavailable');
      },
      { timeout: 10000, maximumAge: 300000 },
    );
  }, [onLocated]);

  useEffect(() => { detect(); }, [detect]);

  const text = state === STATE.locating ? 'Locating…' : (label || 'Set location');
  const muted = state !== STATE.ready;

  return (
    <button
      onClick={detect}
      disabled={state === STATE.locating}
      title={
        state === STATE.denied
          ? 'Location access is blocked. Allow it in your browser to see your area.'
          : 'Detect my location again'
      }
      className={`focus-ring group flex items-center gap-2 px-3 py-2 rounded-lg border border-line text-[13px] font-medium transition-colors max-w-[240px] ${
        muted ? 'text-ink-muted hover:bg-slate-50' : 'text-ink-body hover:bg-slate-50'
      }`}
    >
      <IconMapPin size={16} className={muted ? 'text-slate-400' : 'text-primary'} />
      <span className="truncate">{text}</span>
      <IconCrosshair
        size={13}
        className={`shrink-0 text-slate-400 ${state === STATE.locating ? 'animate-spin-slow' : 'opacity-0 group-hover:opacity-100 transition-opacity'}`}
      />
    </button>
  );
}
