// Animates a number from 0 to `target` on mount, and between values on change.
//
// Uses requestAnimationFrame rather than a timer so it stays in step with the
// display and pauses when the tab is backgrounded. Honours
// prefers-reduced-motion by snapping straight to the value — a counter is
// decorative, and animating it against the user's stated preference is exactly
// the kind of motion that setting exists to stop.
import { useEffect, useRef, useState } from 'react';

const EASE_OUT = (t) => 1 - Math.pow(1 - t, 3);

export default function useCountUp(target, duration = 600) {
  const safeTarget = Number.isFinite(target) ? target : 0;
  const [value, setValue] = useState(safeTarget);
  const fromRef = useRef(safeTarget);
  const frameRef = useRef(0);

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduced || duration <= 0) {
      fromRef.current = safeTarget;
      setValue(safeTarget);
      return undefined;
    }

    const from = fromRef.current;
    const delta = safeTarget - from;
    if (delta === 0) return undefined;

    let start = null;
    const step = (ts) => {
      if (start === null) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      setValue(Math.round(from + delta * EASE_OUT(progress)));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = safeTarget;
      }
    };

    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
  }, [safeTarget, duration]);

  return value;
}
