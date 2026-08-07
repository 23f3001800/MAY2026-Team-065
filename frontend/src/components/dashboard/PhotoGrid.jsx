// Real complaint photos, served from the backend's /uploads mount.
//
// Replaces PhotoTile's placeholder for anywhere media is actually available.
// PhotoTile stays for the pre-submit preview, where there is no URL yet.
//
// Clicking opens a lightbox. It is a plain overlay rather than a dialog
// library: one image, Escape to close, and nothing to tab through inside it.
import React, { useEffect, useState } from 'react';
import { IconImage, IconX } from './icons';

function Lightbox({ photo, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    // Stop the page scrolling behind the overlay.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/80 animate-overlay-in p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Photo"
    >
      <button
        onClick={onClose}
        aria-label="Close photo"
        className="focus-ring absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition"
      >
        <IconX size={20} />
      </button>
      <img
        src={photo.url}
        alt=""
        onClick={(e) => e.stopPropagation()}
        className="max-h-full max-w-full rounded-xl shadow-xl animate-scale-in object-contain"
      />
    </div>
  );
}

function Tile({ photo, onOpen }) {
  // A broken image is likely: uploads live on the API host, so a wrong base URL
  // or a cleared uploads folder both surface here. Show a labelled placeholder
  // rather than the browser's broken-image glyph.
  const [broken, setBroken] = useState(false);

  if (broken) {
    return (
      <div className="aspect-[4/3] rounded-xl border border-line bg-slate-50 text-ink-faint flex flex-col items-center justify-center gap-1.5">
        <IconImage size={22} />
        <span className="text-[11px] font-medium">Image unavailable</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(photo)}
      className="focus-ring lift group relative aspect-[4/3] rounded-xl border border-line overflow-hidden bg-slate-50 hover:shadow-md transition-all"
    >
      <img
        src={photo.url}
        alt=""
        loading="lazy"
        onError={() => setBroken(true)}
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
      />
    </button>
  );
}

export default function PhotoGrid({ photos = [], columns = 'sm:grid-cols-3' }) {
  const [active, setActive] = useState(null);
  if (!photos.length) return null;

  return (
    <>
      <div className={`grid grid-cols-2 ${columns} gap-3`}>
        {photos.map((p) => <Tile key={p.id} photo={p} onOpen={setActive} />)}
      </div>
      {active && <Lightbox photo={active} onClose={() => setActive(null)} />}
    </>
  );
}
