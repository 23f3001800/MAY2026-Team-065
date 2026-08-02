// Officer Analytics — computed entirely client-side from GET /complaints/.
//
// GET /admin/analytics exists but is administrator-only server-side (main.py
// 403s any other role), so an officer can't call it. The good news is
// GET /complaints/ already returns every complaint to an officer (same as an
// admin), which is enough to compute the same breakdowns in the browser.
import React, { useMemo } from 'react';
import StatTile from '../../components/dashboard/StatTile';
import BarList from '../../components/admin/BarList';
import LineChart from '../../components/admin/LineChart';
import { LoadingPanel, ErrorPanel } from '../../components/dashboard/AsyncStates';
import { listComplaints } from '../../api/complaints';
import useAsync from '../../hooks/useAsync';

const STATUS_COLORS = { New: '#10b981', Assigned: '#f59e0b', Resolved: '#8b5cf6', Rejected: '#ef4444' };
const SEVERITY_COLORS = { Low: '#10b981', Medium: '#f59e0b', High: '#ef4444', Critical: '#991b1b' };

function monthKey(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString(undefined, { month: 'short' });
}

function countBy(items, key) {
  const counts = new Map();
  for (const item of items) counts.set(item[key], (counts.get(item[key]) || 0) + 1);
  return counts;
}

export default function OfficerAnalytics() {
  const { data, error, loading, refetch } = useAsync(() => listComplaints(), []);
  const complaints = useMemo(() => data || [], [data]);

  const resolved = useMemo(() => complaints.filter((c) => c.status === 'Resolved'), [complaints]);

  const avgResolutionDays = useMemo(() => {
    if (resolved.length === 0) return null;
    const totalMs = resolved.reduce((sum, c) => sum + (new Date(c.updatedAt) - new Date(c.reportedAt)), 0);
    return (totalMs / resolved.length / 86400000).toFixed(1);
  }, [resolved]);

  const statusData = useMemo(() => {
    const counts = countBy(complaints, 'status');
    return ['New', 'Assigned', 'Resolved', 'Rejected'].map((s) => ({
      label: s, value: counts.get(s) || 0, color: STATUS_COLORS[s],
    }));
  }, [complaints]);

  const severityData = useMemo(() => {
    const counts = countBy(complaints, 'severity');
    return ['Low', 'Medium', 'High', 'Critical'].map((s) => ({
      label: s, value: counts.get(s) || 0, color: SEVERITY_COLORS[s],
    }));
  }, [complaints]);

  const categoryData = useMemo(() => {
    const counts = countBy(complaints, 'category');
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value, color: '#10b981' }));
  }, [complaints]);

  const monthlyTrend = useMemo(() => {
    const counts = new Map();
    for (const c of complaints) {
      const key = monthKey(c.reportedAt);
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts.entries()].map(([label, value]) => ({ label, value }));
  }, [complaints]);

  return (
    <div className="max-w-[1200px] mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Analytics</h1>
        <p className="text-[14px] text-slate-500">
          Computed from the full complaint list — the city-wide analytics endpoint is admin-only.
        </p>
      </div>

      {loading ? (
        <LoadingPanel label="Crunching the numbers…" />
      ) : error ? (
        <ErrorPanel error={error} onRetry={refetch} />
      ) : (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <StatTile label="Total Complaints" value={complaints.length} tone="emerald" />
            <StatTile label="Resolved" value={resolved.length} tone="purple" />
            <StatTile
              label="Resolution Rate"
              value={complaints.length ? `${Math.round((resolved.length / complaints.length) * 100)}%` : '—'}
              tone="blue"
            />
            <StatTile label="Avg. Resolution Time" value={avgResolutionDays ? `${avgResolutionDays} days` : '—'} tone="amber" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {monthlyTrend.length > 1 && <LineChart title="Complaints Over Time" data={monthlyTrend} />}
            <BarList title="By Category" data={categoryData.length ? categoryData : [{ label: 'No data', value: 0, color: '#94a3b8' }]} />
            <BarList title="By Status" data={statusData} />
            <BarList title="By Severity" data={severityData} />
          </div>
        </>
      )}
    </div>
  );
}
