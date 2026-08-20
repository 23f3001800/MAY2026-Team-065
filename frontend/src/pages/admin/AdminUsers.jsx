// User Management -- search/filter every account, create officers and field
// workers, edit them, suspend/reactivate, and reset passwords.
//
// Backed by GET /admin/users, POST /admin/users/official, POST /workers/,
// PATCH /admin/users/{id}, DELETE /admin/users/{id} and
// PATCH /users/{id}/reset-password.
//
// Everything on this screen persists. Through Sprint 1 it did not: the update
// endpoint reported success while saving nothing, and suspension had no column
// to write to, so the UI deliberately refused to claim otherwise. Both were
// fixed server-side, and suspension now blocks sign-in and invalidates tokens
// already issued.
//
// Deleting a user is a soft delete by design. Complaints reference citizenId,
// officerId and fieldWorkerId, so removing the row would orphan the audit
// trail; the account is deactivated instead.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import CreateOfficerModal from '../../components/admin/CreateOfficerModal';
import EditUserModal from '../../components/admin/EditUserModal';
import CreateWorkerModal from '../../components/admin/CreateWorkerModal';
import ResetPasswordModal from '../../components/admin/ResetPasswordModal';
import UnavailableNote from '../../components/dashboard/UnavailableNote';
import { LoadingPanel, ErrorPanel, EmptyPanel } from '../../components/dashboard/AsyncStates';
import { IconSearch, IconChevronDown, IconUserPlus, IconUsers, IconCheckCircle } from '../../components/dashboard/icons';
import { parseSkills } from '../../lib/skills';
import { listUsers, updateUser, deactivateUser } from '../../api/admin';
import { listComplaints } from '../../api/complaints';
import { TERMINAL_STATUSES } from '../../api/mappers';
import useAsync from '../../hooks/useAsync';

const ROLE_OPTIONS = [
  { value: 'citizen', label: 'Citizen' },
  { value: 'officer', label: 'Municipal Officer' },
  { value: 'field_worker', label: 'Field Worker' },
  { value: 'administrator', label: 'Administrator' },
];

const ROLE_PILL = {
  citizen: 'bg-emerald-50 text-emerald-700',
  officer: 'bg-blue-50 text-blue-700',
  field_worker: 'bg-amber-50 text-amber-700',
  administrator: 'bg-violet-50 text-violet-700',
};

export default function AdminUsers() {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const { data, error, loading, refetch, setData } = useAsync(() => listUsers({ query, role: role || undefined }), [query, role]);
  const users = useMemo(() => data || [], [data]);

  const [showCreateOfficer, setShowCreateOfficer] = useState(false);
  const [showCreateWorker, setShowCreateWorker] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);

  // How much open work each staff account still holds. Suspending someone who
  // is mid-job leaves the complaint pointing at an account that cannot sign in,
  // and nothing on the complaint would say why it had stalled.
  const [openWork, setOpenWork] = useState({});
  const [toast, setToast] = useState('');
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    listComplaints()
      .then((complaints) => {
        if (cancelled) return;
        const counts = {};
        for (const c of complaints || []) {
          if (TERMINAL_STATUSES.includes(c.status)) continue;
          for (const id of [c.fieldWorkerId, c.officerId]) {
            if (id) counts[id] = (counts[id] || 0) + 1;
          }
        }
        setOpenWork(counts);
      })
      // Not fatal: without it the suspend guard simply does not fire, which is
      // the same behaviour this screen had before the guard existed.
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const flash = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  }, []);

  const handleCreated = (source, msg) => {
    source(false);
    flash(msg);
    refetch();
  };

  const toggleActive = async (user) => {
    setBusyId(user.id);
    try {
      // Suspension is a real state now: it blocks sign-in and invalidates
      // tokens already issued, so the message says so rather than hedging with
      // "the backend accepted the request".
      const updated = user.isActive
        ? await deactivateUser(user.id)
        : await updateUser(user.id, { isActive: true });
      setData((list) => (list || []).map((u) => (u.id === user.id ? updated : u)));
      flash(user.isActive
        ? `${user.name} suspended — they can no longer sign in.`
        : `${user.name} reactivated.`);
    } catch (err) {
      if (err.name !== 'SessionExpiredError') flash(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-[1100px] mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">User Management</h1>
          <p className="text-[14px] text-slate-500">Search accounts, provision staff, and manage access.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreateWorker(true)}
            className="inline-flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-[13px] px-3.5 py-2.5 rounded-xl transition-colors"
          >
            <IconUserPlus size={15} /> Field Worker
          </button>
          <button
            onClick={() => setShowCreateOfficer(true)}
            className="inline-flex items-center gap-2 bg-primary hover:bg-emerald-600 text-white font-semibold text-[13px] px-3.5 py-2.5 rounded-xl shadow-btn transition-colors"
          >
            <IconUserPlus size={15} /> Officer
          </button>
        </div>
      </div>

      {toast && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[13px] font-medium px-4 py-3 rounded-xl">
          <IconCheckCircle size={16} className="shrink-0" /> {toast}
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[220px] flex items-center gap-2 bg-white rounded-xl border border-slate-200 px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-emerald-100 transition">
          <IconSearch size={18} className="text-slate-400 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email…"
            className="flex-1 py-2.5 text-[14px] text-slate-800 outline-none bg-transparent"
          />
        </div>
        <div className="relative">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="appearance-none bg-white rounded-xl border border-slate-200 pl-3.5 pr-9 py-2.5 text-[14px] text-slate-700 outline-none focus:border-primary cursor-pointer"
          >
            <option value="">All Roles</option>
            {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <IconChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {loading ? (
        <LoadingPanel label="Loading users…" variant="table" />
      ) : error ? (
        <ErrorPanel error={error} onRetry={refetch} />
      ) : users.length === 0 ? (
        <EmptyPanel icon={IconUsers} title="No users found" message="Try a different search or role filter." />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
                  <th className="font-semibold px-5 py-3">Name</th>
                  <th className="font-semibold px-3 py-3">Email</th>
                  <th className="font-semibold px-3 py-3">Role</th>
                  <th className="font-semibold px-3 py-3">Department / Skills</th>
                  <th className="font-semibold px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 text-[13px] font-medium text-slate-800 whitespace-nowrap">{u.name}</td>
                    <td className="px-3 py-3 text-[13px] text-slate-500 whitespace-nowrap">{u.email}</td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap ${ROLE_PILL[String(u.role).toLowerCase()] || 'bg-slate-100 text-slate-600'}`}>
                        {u.roleLabel}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-[13px] text-slate-500">
                      {u.department ? u.department : parseSkills(u.skillSet).length ? (
                        <span className="flex flex-wrap gap-1">
                          {parseSkills(u.skillSet).map((s) => (
                            <span key={s} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px] font-medium whitespace-nowrap">
                              {s}
                            </span>
                          ))}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => setEditTarget(u)}
                        className="text-[12px] font-semibold text-slate-600 hover:underline mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setResetTarget(u)}
                        className="text-[12px] font-semibold text-primary hover:underline mr-3"
                      >
                        Reset password
                      </button>
                      <button
                        onClick={() => toggleActive(u)}
                        disabled={busyId === u.id}
                        className={`text-[12px] font-semibold hover:underline disabled:opacity-50 ${u.isActive ? 'text-red-600' : 'text-emerald-600'}`}
                      >
                        {u.isActive ? 'Suspend' : 'Reactivate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <UnavailableNote>
        Suspending blocks sign-in immediately, including sessions already open, and is reversible.
        Accounts are never hard-deleted: complaints reference the people on them, so removing a row
        would orphan the history. An account holding open complaints cannot be suspended until that
        work is reassigned.
      </UnavailableNote>

      {showCreateOfficer && (
        <CreateOfficerModal onDismiss={() => setShowCreateOfficer(false)} onCreated={(msg) => handleCreated(setShowCreateOfficer, msg)} />
      )}
      {showCreateWorker && (
        <CreateWorkerModal onDismiss={() => setShowCreateWorker(false)} onCreated={(msg) => handleCreated(setShowCreateWorker, msg)} />
      )}
      {editTarget && (
        <EditUserModal
          user={editTarget}
          openWorkCount={openWork[editTarget.id] || 0}
          onDismiss={() => setEditTarget(null)}
          onSaved={(updated, msg) => {
            // Patch the row in place from the response rather than refetching:
            // the endpoint returns the saved record, so a round trip would only
            // confirm what we already have.
            setData((list) => (list || []).map((u) => (u.id === updated.id ? updated : u)));
            flash(msg);
          }}
        />
      )}
      {resetTarget && (
        <ResetPasswordModal
          user={resetTarget}
          onDismiss={() => setResetTarget(null)}
          onDone={(msg) => { setResetTarget(null); flash(msg); }}
        />
      )}
    </div>
  );
}
