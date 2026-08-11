// Before / after evidence for a complaint.
//
// This is the heart of the detail page and it was previously two unlabelled
// photo grids stacked in a narrow column. The whole point of the pair is the
// comparison — "here is what was reported, here is what was done" — so they sit
// side by side under explicit headings, and the after column says plainly when
// nothing has been submitted yet rather than just not rendering.
//
// Splitting on the resolution timestamp is a heuristic: the media response
// carries an uploader id we cannot resolve to a role. It is the honest signal
// available, and the headings say "reported" / "completion" rather than naming
// who took each photo.
//
// Upload is offered only to people the backend will actually accept:
// POST /complaints/{id}/images allows the owning citizen or the assigned field
// worker. Showing the control to an officer would be offering a 403.
import React, { useRef, useState } from 'react';
import PhotoGrid from './PhotoGrid';
import { IconUpload, IconCamera, IconCheckCircle, IconAlertTriangle } from './icons';
import { uploadComplaintImages } from '../../api/complaints';

const MAX_IMAGE_MB = 5;

function Column({ title, caption, photos, tone, emptyText, children }) {
  const accent = tone === 'after'
    ? 'border-teal-100 bg-teal-50/40'
    : 'border-line bg-surface-inset/60';

  return (
    <div className={`rounded-xl border ${accent} p-4`}>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <h3 className="font-display text-[14px] font-bold text-ink">{title}</h3>
        <span className="text-[11px] text-ink-faint tnum">{photos.length}</span>
      </div>
      <p className="text-[11px] text-ink-muted mb-3">{caption}</p>

      {photos.length > 0 ? (
        <PhotoGrid photos={photos} columns="sm:grid-cols-2" />
      ) : (
        <div className="rounded-lg border border-dashed border-line py-8 px-3 text-center">
          <IconCamera size={20} className="text-ink-faint mx-auto mb-1.5" />
          <p className="text-[12px] text-ink-muted leading-snug">{emptyText}</p>
        </div>
      )}

      {children}
    </div>
  );
}

export default function EvidencePanel({
  complaintId, reportPhotos, resolutionPhotos, canUpload, uploadKind = 'after', onUploaded,
}) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const upload = async (fileList) => {
    const files = Array.from(fileList || []).filter((f) => {
      if (!f.type.startsWith('image/')) return false;
      if (f.size > MAX_IMAGE_MB * 1024 * 1024) {
        setError(`${f.name} is over ${MAX_IMAGE_MB}MB.`);
        return false;
      }
      return true;
    });
    if (!files.length) return;

    setBusy(true);
    setError('');
    try {
      await uploadComplaintImages(complaintId, files);
      setDone(true);
      // The parent refetches media so the new photos appear in the right
      // column rather than being appended optimistically to the wrong one.
      onUploaded?.();
      setTimeout(() => setDone(false), 2500);
    } catch (err) {
      if (err.name !== 'SessionExpiredError') setError(err.message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const uploadControl = canUpload && (
    <div className="mt-3">
      <label className="focus-ring flex items-center justify-center gap-2 cursor-pointer rounded-lg border-2 border-dashed border-line hover:border-civic-400 hover:bg-surface px-3 py-2.5 transition-colors">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg"
          multiple
          className="hidden"
          disabled={busy}
          onChange={(e) => upload(e.target.files)}
        />
        <IconUpload size={15} className="text-civic-600" />
        <span className="text-[12px] font-semibold text-ink-body">
          {busy ? 'Uploading…' : uploadKind === 'after' ? 'Add completion photos' : 'Add more photos'}
        </span>
      </label>

      {done && (
        <p className="flex items-center gap-1.5 text-[11px] text-teal-700 mt-2">
          <IconCheckCircle size={12} /> Uploaded.
        </p>
      )}
      {error && (
        <p role="alert" className="flex items-start gap-1.5 text-[11px] text-danger-700 mt-2">
          <IconAlertTriangle size={12} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}
    </div>
  );

  return (
    <section className="bg-surface rounded-xl border border-line shadow-sm p-5">
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <h2 className="font-display text-[16px] font-bold text-ink">Evidence</h2>
        <span className="text-[12px] text-ink-muted">
          {reportPhotos.length + resolutionPhotos.length} photo
          {reportPhotos.length + resolutionPhotos.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Column
          title="Before"
          caption="Uploaded when the issue was reported"
          photos={reportPhotos}
          tone="before"
          emptyText="No photo was attached when this was reported."
        >
          {uploadKind === 'before' && uploadControl}
        </Column>

        <Column
          title="After"
          caption="Completion evidence from the field"
          photos={resolutionPhotos}
          tone="after"
          emptyText="No completion photo yet — the work is not finished, or it was closed without one."
        >
          {uploadKind === 'after' && uploadControl}
        </Column>
      </div>
    </section>
  );
}
