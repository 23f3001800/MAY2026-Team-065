// Small "not available" banner for panels that would otherwise have to fake
// data the backend doesn't provide. Same honesty pattern as the AI Assistance
// section in ComplaintDrawer -- say what's missing instead of inventing it.
import React from 'react';
import { IconInfo } from '../icons';

export default function UnavailableNote({ children }) {
  return (
    <p className="flex items-start gap-2 text-[12px] text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3">
      <span className="mt-0.5 shrink-0 text-slate-400"><IconInfo size={14} /></span>
      <span>{children}</span>
    </p>
  );
}
