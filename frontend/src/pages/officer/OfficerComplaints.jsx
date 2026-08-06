// Officer complaint queue — thin wrapper around the shared ComplaintQueue
// (see pages/shared/ComplaintQueue.jsx). The backend authorizes officers and
// administrators identically on every complaint-management endpoint, so the
// two screens only differ in copy.
import React from 'react';
import ComplaintQueue from '../shared/ComplaintQueue';

export default function OfficerComplaints() {
  return <ComplaintQueue title="Complaint Queue" subtitle="Review, prioritise and assign complaints across the city." />;
}
