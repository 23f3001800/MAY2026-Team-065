// TEMPORARY detail view data, derived from the same list the My Complaints
// table renders so every row links somewhere real.
// TODO(raja-api): replace with GET /api/complaints/:id, which should return the
// complaint joined with status_histories, media_attachments and feedbacks.
import { myComplaints } from './mockComplaints';

// The happy-path lifecycle. A complaint's timeline is every stage up to and
// including its current status. "Rejected" is a terminal branch off "New".
const LIFECYCLE = ['New', 'Assigned', 'In Progress', 'Resolved'];

// Per-complaint colour: description and who is working it. Anything not listed
// falls back to a generic entry so no id 404s.
const EXTRAS = {
  'CC-2024-001245': {
    description:
      'Large pothole in the middle of the northbound lane, roughly two feet across and deep enough to jolt a two-wheeler. It has widened noticeably since the rain last week.',
    worker: 'Ravi Kumar',
    department: 'Roads & Infrastructure',
  },
  'CC-2024-001244': {
    description:
      'The community bin next to the vegetable market has not been cleared in four days. Waste is spilling onto the footpath and there is a strong smell.',
    worker: 'Sunil Das',
    department: 'Sanitation',
  },
  'CC-2024-001243': {
    description:
      'Continuous water leak from a burst pipe under the footpath. Water has been running for two days and the paving has started to sink.',
    worker: null,
    department: 'Water Supply',
  },
  'CC-2024-001242': {
    description:
      'Streetlight outside house number 42 has been dark for a week, leaving the stretch up to the bus stop unlit after 7pm.',
    worker: 'Meena Iyer',
    department: 'Electrical',
  },
  'CC-2024-001240': {
    description:
      'Construction debris and household waste dumped along the park boundary wall overnight.',
    worker: 'Sunil Das',
    department: 'Sanitation',
  },
  'CC-2024-001238': {
    description:
      'Deep pothole directly outside the school gate. Children walk around it into oncoming traffic.',
    worker: 'Ravi Kumar',
    department: 'Roads & Infrastructure',
  },
  'CC-2024-001235': {
    description: 'Drain overflowing onto the road after moderate rain.',
    worker: null,
    department: 'Water Supply',
  },
  'CC-2024-001231': {
    description: 'Street lamp flickers through the night and buzzes audibly.',
    worker: 'Meena Iyer',
    department: 'Electrical',
  },
};

// Resolution evidence + citizen feedback, only for complaints that got there.
const RESOLUTIONS = {
  'CC-2024-001240': {
    remarks:
      'Debris cleared and hauled away. Area swept and the boundary wall stretch has been added to the twice-weekly collection round to stop it recurring.',
    resolvedBy: 'Sunil Das',
    photoCaptions: ['Area after clearing', 'Waste loaded for disposal'],
    feedback: { rating: 5, comments: 'Cleared the next morning. Very well handled, thank you.' },
  },
  'CC-2024-001238': {
    remarks:
      'Pothole cut back to a clean edge, filled with hot mix and compacted. Surface is level with the surrounding road and open to traffic.',
    resolvedBy: 'Ravi Kumar',
    photoCaptions: ['Repaired surface', 'Compaction in progress'],
    feedback: null, // awaiting the citizen's rating
  },
  'CC-2024-001231': {
    remarks: 'Faulty ballast replaced and the fitting resealed. Lamp tested after dark and is steady.',
    resolvedBy: 'Meena Iyer',
    photoCaptions: ['Replaced fitting'],
    feedback: { rating: 4, comments: 'Fixed, though it took a while to get started.' },
  },
};

const REJECTIONS = {
  'CC-2024-001235': 'Closed as a duplicate of CC-2024-001220, which covers the same drain and is in progress.',
};

// Timestamps are spaced back from the complaint date so the timeline reads in
// a believable order. `step` is how far along the lifecycle the entry is.
function stampAt(dateISO, step) {
  const d = new Date(`${dateISO}T09:15:00`);
  d.setHours(d.getHours() + step * 26);
  return d.toISOString();
}

function buildTimeline(complaint, extras) {
  const { id, status, date } = complaint;

  if (status === 'Rejected') {
    return [
      { status: 'New', at: stampAt(date, 0), actor: 'You', remarks: 'Complaint submitted.' },
      {
        status: 'Rejected',
        at: stampAt(date, 1),
        actor: 'Grievance Officer',
        remarks: REJECTIONS[id] || 'Closed after review.',
      },
    ];
  }

  const reached = LIFECYCLE.slice(0, LIFECYCLE.indexOf(status) + 1);
  return reached.map((stage, i) => {
    const at = stampAt(date, i);
    switch (stage) {
      case 'Assigned':
        return {
          status: stage,
          at,
          actor: 'Grievance Officer',
          remarks: extras.worker
            ? `Routed to ${extras.department} and assigned to ${extras.worker}.`
            : `Routed to ${extras.department}.`,
        };
      case 'In Progress':
        return {
          status: stage,
          at,
          actor: extras.worker || 'Field Worker',
          remarks: 'Work started on site.',
        };
      case 'Resolved':
        return {
          status: stage,
          at,
          actor: RESOLUTIONS[id]?.resolvedBy || extras.worker || 'Field Worker',
          remarks: 'Marked resolved with evidence attached.',
        };
      default:
        return { status: stage, at, actor: 'You', remarks: 'Complaint submitted.' };
    }
  });
}

// Returns the full detail record for a complaint id, or null if unknown.
export function getComplaintDetail(id) {
  const complaint = myComplaints.find((c) => c.id === id);
  if (!complaint) return null;

  const extras = EXTRAS[id] || { description: 'No further details were provided.', worker: null, department: 'General' };
  const resolution = RESOLUTIONS[id] || null;
  const timeline = buildTimeline(complaint, extras);

  return {
    ...complaint,
    description: extras.description,
    department: extras.department,
    assignedTo: extras.worker,
    photoCaptions: ['Reported by you at submission'],
    timeline,
    resolution: resolution
      ? {
          remarks: resolution.remarks,
          resolvedBy: resolution.resolvedBy,
          resolvedAt: timeline[timeline.length - 1].at,
          photoCaptions: resolution.photoCaptions,
        }
      : null,
    feedback: resolution?.feedback
      ? { ...resolution.feedback, submittedAt: timeline[timeline.length - 1].at }
      : null,
  };
}

export { LIFECYCLE };
