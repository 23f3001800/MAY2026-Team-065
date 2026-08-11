// Splitting complaint photos into "before" and "after".
//
// The media response carries `uploadedBy` (a user id) and `uploadedAt`, but no
// role — and ComplaintResponse has no citizenId, so we cannot simply ask "was
// this the reporter?".
//
// The previous approach split on the complaint's transition into RESOLVED:
// anything uploaded at or after it was completion evidence. That was wrong in
// exactly the flow the app encourages. The worker screen uploads photos FIRST
// and moves the status second — deliberately, so a failed upload is recoverable
// — which put every completion photo before the RESOLVED timestamp and filed it
// under "before".
//
// Splitting by UPLOADER is robust to that. The citizen uploads at submission,
// so whoever owns the earliest attachment is the reporter; anyone else is field
// staff. Ordering of uploads within a session no longer matters.
const NEAR_SUBMISSION_MS = 15 * 60 * 1000;

/**
 * @param {Array} media       from getComplaintMedia
 * @param {string} reportedAt complaint.reportedAt, used only for the fallback
 * @param {string} [citizenId] the reporter, when known — makes this exact
 * @returns {{ before: Array, after: Array }}
 */
export function splitEvidence(media = [], reportedAt, citizenId) {
  const items = [...media].filter(Boolean).sort(
    (a, b) => new Date(a.uploadedAt || 0) - new Date(b.uploadedAt || 0),
  );
  if (!items.length) return { before: [], after: [] };

  // Exact path: ComplaintResponse now carries citizenId, so the reporter's
  // photos can be identified rather than inferred. Everything below this is a
  // fallback for records where it is missing.
  if (citizenId) {
    return {
      before: items.filter((m) => m.uploadedBy === citizenId),
      after: items.filter((m) => m.uploadedBy !== citizenId),
    };
  }

  const uploaders = new Set(items.map((m) => m.uploadedBy).filter(Boolean));

  // Normal case: more than one person has attached something. The earliest
  // uploader is the reporter.
  if (uploaders.size > 1) {
    const reporter = items.find((m) => m.uploadedBy)?.uploadedBy;
    return {
      before: items.filter((m) => m.uploadedBy === reporter),
      after: items.filter((m) => m.uploadedBy !== reporter),
    };
  }

  // One uploader (or none recorded). Fall back to timing: anything attached
  // around submission is context, anything much later is completion evidence.
  // A worker re-photographing their own earlier report is rare enough that a
  // wrong guess here costs a mislabelled thumbnail, not a wrong decision.
  const base = new Date(reportedAt || items[0].uploadedAt).getTime();
  const before = [];
  const after = [];
  for (const m of items) {
    const at = new Date(m.uploadedAt || 0).getTime();
    if (!Number.isFinite(at) || at - base <= NEAR_SUBMISSION_MS) before.push(m);
    else after.push(m);
  }
  return { before, after };
}
