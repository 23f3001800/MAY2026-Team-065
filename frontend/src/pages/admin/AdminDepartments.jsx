// Departments — there is no Department entity or endpoint on the backend.
// A "department" only exists as a string: a field on CategoryModel (which
// route complaints there) and on MunicipalOfficerModel (which officer sits in
// it). This page derives the department list from the categories mirror and
// rolls up real counts for each one from three calls the admin can already
// make: complaints, users (for officers), and field workers (matched by a
// department name appearing in their free-text skillSet).
import React, { useMemo } from 'react';
import { LoadingPanel, ErrorPanel } from '../../components/dashboard/AsyncStates';
import UnavailableNote from '../../components/dashboard/UnavailableNote';
import { IconBuilding, IconUsers, IconClipboard } from '../../components/dashboard/icons';
import { CATEGORIES } from '../../api/mappers';
import { listComplaints } from '../../api/complaints';
import { listUsers } from '../../api/admin';
import { listFieldWorkers } from '../../api/workers';
import useAsync from '../../hooks/useAsync';

const DEPARTMENTS = [...new Set(CATEGORIES.map((c) => c.department))];

async function loadDepartments() {
  const [complaints, officers, workers] = await Promise.all([
    listComplaints(),
    listUsers({ role: 'officer', limit: 100 }),
    listFieldWorkers(),
  ]);
  return { complaints, officers, workers };
}

export default function AdminDepartments() {
  const { data, error, loading, refetch } = useAsync(loadDepartments, []);

  const rows = useMemo(() => {
    if (!data) return [];
    const { complaints, officers, workers } = data;
    return DEPARTMENTS.map((dept) => ({
      department: dept,
      complaintCount: complaints.filter((c) => c.department === dept).length,
      officerCount: officers.filter((o) => o.department === dept).length,
      workerCount: workers.filter((w) => (w.skill || '').toLowerCase().includes(dept.toLowerCase())).length,
    }));
  }, [data]);

  return (
    <div className="max-w-[1000px] mx-auto space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Departments</h1>
        <p className="text-[14px] text-slate-500">Staffing and complaint load by department.</p>
      </div>

      <UnavailableNote>
        The backend has no Department entity — "department" is just a text field on categories and on
        officer accounts. This view is derived from that text across complaints, officers and field
        workers (matched by their skill text), not a managed list.
      </UnavailableNote>

      {loading ? (
        <LoadingPanel label="Rolling up departments…" />
      ) : error ? (
        <ErrorPanel error={error} onRetry={refetch} />
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {rows.map((r) => (
            <li key={r.department} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <IconBuilding size={17} />
                </span>
                <h3 className="text-[14px] font-semibold text-slate-800">{r.department}</h3>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="font-display text-[20px] font-bold text-slate-900">{r.complaintCount}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5 flex items-center justify-center gap-1"><IconClipboard size={11} /> Complaints</div>
                </div>
                <div>
                  <div className="font-display text-[20px] font-bold text-slate-900">{r.officerCount}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5 flex items-center justify-center gap-1"><IconUsers size={11} /> Officers</div>
                </div>
                <div>
                  <div className="font-display text-[20px] font-bold text-slate-900">{r.workerCount}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5 flex items-center justify-center gap-1"><IconUsers size={11} /> Workers</div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
