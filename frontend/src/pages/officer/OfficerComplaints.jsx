// Officer complaint queue — thin wrapper around the shared ComplaintQueue
// (see pages/shared/ComplaintQueue.jsx). The backend authorizes officers and
// administrators identically on every complaint-management ACTION, so the two
// screens differ only in copy and in what the list contains: GET /complaints/
// scopes an officer to their own department, while an administrator gets the
// whole city.
import React from 'react';
import ComplaintQueue from '../shared/ComplaintQueue';

export default function OfficerComplaints() {
  return <ComplaintQueue title="Complaint Queue" subtitle="Review, prioritise and assign the complaints routed to your department." />;
}
