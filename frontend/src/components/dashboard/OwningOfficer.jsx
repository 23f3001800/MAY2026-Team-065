// Who is supposed to be looking at this complaint.
//
// officerId is set at filing now rather than at dispatch, so most complaints
// have an answer where they previously had none. It is worth showing: the
// escalation, resolution and SLA-breach notices for a complaint are addressed
// to its officer, so an ownerless one is one whose alerts go nowhere.
//
// Still null when the complaint's department has no officer at all, and that
// empty state is kept and given a reason rather than hidden — it is the visible
// symptom of a staffing gap, and the admin fix is the routing panel plus an
// appointment.
import React from 'react';
import { IconUsers } from './icons';
import useOfficerName from '../../hooks/useOfficerName';

/**
 * @param {string|null} officerId
 * @param {string|null} [department] used to word the answer when the id cannot
 *   be resolved to a name, and to explain the empty state.
 * @param {'inline'|'row'} [variant] 'row' adds the icon and the explanatory
 *   second line; 'inline' is a bare value for a definition list.
 */
export default function OwningOfficer({ officerId, department, variant = 'row' }) {
  const { label, isYou, loading } = useOfficerName(officerId);

  let value;
  let note = null;

  if (!officerId) {
    value = <span className="text-ink-faint">No owning officer</span>;
    note = department
      ? `No officer is registered for ${department}, so escalation and breach notices for this complaint reach nobody.`
      : 'Escalation and breach notices for this complaint reach nobody until it has one.';
  } else if (isYou) {
    value = <span className="font-semibold text-leaf-700">You</span>;
    note = 'This one is yours to triage.';
  } else if (loading) {
    value = <span className="text-ink-faint">Looking up…</span>;
  } else if (label) {
    value = label;
  } else {
    // Deliberately not the id. A UUID on screen answers nothing, and there is
    // no directory this viewer is allowed to read — see useOfficerName.
    value = department ? `An officer in ${department}` : 'Another officer';
  }

  if (variant === 'inline') return <>{value}</>;

  return (
    <div className="flex items-start gap-2">
      <IconUsers size={14} className="mt-0.5 shrink-0 text-ink-faint" />
      <div className="min-w-0">
        <div className="text-[13px] text-ink">{value}</div>
        {note && <p className="mt-0.5 text-[11.5px] leading-snug text-ink-faint">{note}</p>}
      </div>
    </div>
  );
}
