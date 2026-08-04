// Admin complaint queue — same shared component the officer area uses (see
// pages/shared/ComplaintQueue.jsx). GET /complaints/ and every PATCH action
// authorize "administrator" identically to "officer" server-side, so an
// admin gets the exact same city-wide queue with the same assign/status/
// recategorise actions.
import React from 'react';
import ComplaintQueue from '../shared/ComplaintQueue';

export default function AdminComplaints() {
  return <ComplaintQueue title="Complaints" subtitle="Every complaint in the city, with full assign, status and category controls." />;
}
