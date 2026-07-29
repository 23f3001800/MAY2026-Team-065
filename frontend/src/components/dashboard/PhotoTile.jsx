// Stand-in for a complaint / resolution photo.
//
// The backend does not serve media yet and we deliberately avoid remote image
// URLs so the UI works offline and in the build. Once media lands, swap the
// body of this component for an <img src={url}> and keep the caption chrome.
import React from 'react';
import { IconImage } from './icons';

const TONES = {
  citizen: 'from-slate-100 to-slate-200 text-slate-400',
  resolution: 'from-emerald-50 to-emerald-100 text-emerald-500',
};

export default function PhotoTile({ caption, tone = 'citizen', className = '' }) {
  return (
    <figure className={className}>
      <div
        className={`aspect-[4/3] rounded-xl border border-slate-200 bg-gradient-to-br ${TONES[tone]} flex flex-col items-center justify-center gap-1.5`}
      >
        <IconImage size={26} />
        <span className="text-[11px] font-medium opacity-80">Photo</span>
      </div>
      {caption && (
        <figcaption className="text-[12px] text-slate-500 mt-1.5 leading-snug">{caption}</figcaption>
      )}
    </figure>
  );
}
