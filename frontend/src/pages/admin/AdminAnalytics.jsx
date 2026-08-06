// Analytics — the deep-dive version of the dashboard's KPI row.
// GET /admin/analytics gives the status/severity breakdown directly; category
// breakdown, the monthly trend, and average resolution time are computed
// client-side from GET /complaints/, same as the officer's analytics page.
import React, { useMemo } from 'react';
import StatTile from '../../components/dashboard/StatTile';
import BarList from '../../components/admin/BarList';
import LineChart from '../../components/admin/LineChart';
import { LoadingPanel, ErrorPanel } from '../../components/dashboard/AsyncStates';
import { getCityAnalytics } from '../../api/admin';
import { listComplaints } from '../../api/complaints';
import useAsync from '../../hooks/useAsync';

const STATUS_COLORS = { PENDING: '#10b981', ASSIGNED: '#f59e0b', RESOLVED: '#8b5cf6', REJECTED: '#ef4444' };
const STATUS_LABELS = { PENDING: 'New', ASSIGNED: 'Assigned', RESOLVED: 'Resolved', REJECTED: 'Rejected' };
const SEVERITY_COLORS = { LOW: '#10b981', MEDIUM: '#f59e0b', HIGH: '#ef4444', CRITICAL: '#991b1b' };

function monthKey(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString(undefined, { month: 'short' });
}

async function loadAnalytics() {
  const [analytics, complaints] = await Promise.all([getCityAnalytics(), listComplaints()]);
  return { analytics, complaints };
}

export default function AdminAnalytics() {
  const { data, error, loading, refetch } = useAsync(loadAnalytics, []);

  const statusData = useMemo(() => {
    if (!data) return [];
    const byStatus = data.analytics.breakdownByStatus || {};
    return Object.keys(STATUS_LABELS).map((key) => ({
      label: STATUS_LABELS[key], value: byStatus[key] || 0, color: STATUS_COLORS[key],
    }));
  }, [data]);

  const severityData = useMemo(() => {
    if (!data) return [];
    const bySeverity = data.analytics.breakdownBySeverity || {};
    return Object.keys(SEVERITY_COLORS).map((key) => ({
      label: key.charAt(0) + key.slice(1).toLowerCase(), value: bySeverity[key] || 0, color: SEVERITY_COLORS[key],
    }));
  }, [data]);

  const categoryData = useMemo(() => {
    if (!data) return [];
    const counts = new Map();
    for (const c of data.complaints) counts.set(c.category, (counts.get(c.category) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value, color: '#10b981' }));
  }, [data]);

  const monthlyTrend = useMemo(() => {
    if (!data) return [];
    const counts = new Map();
    for (const c of data.complaints) {
      const key = monthKey(c.reportedAt);
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts.entries()].map(([label, value]) => ({ label, value }));
  }, [data]);

  const avgResolutionDays = useMemo(() => {
    if (!data) return null;
    const resolved = data.complaints.filter((c) => c.status === 'Resolved');
    if (resolved.length === 0) return null;
    const totalMs = resolved.reduce((sum, c) => sum + (new Date(c.updatedAt) - new Date(c.reportedAt)), 0);
    return (totalMs / resolved.length / 86400000).toFixed(1);
  }, [data]);

  return (
    <div className="max-w-[1200px] mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Analytics</h1>
        <p className="text-[14px] text-slate-500">City-wide complaint statistics.</p>
      </div>

      {loading ? (
        <LoadingPanel label="Crunching the numbers…" />
      ) : error ? (
        <ErrorPanel error={error} onRetry={refetch} />
      ) : (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <StatTile label="Total Complaints" value={data.analytics.overview?.totalComplaints ?? data.complaints.length} tone="emerald" />
            <StatTile label="Resolved" value={data.analytics.breakdownByStatus?.RESOLVED || 0} tone="purple" />
            <StatTile label="Critical Severity" value={data.analytics.breakdownBySeverity?.CRITICAL || 0} tone="amber" />
            <StatTile label="Avg. Resolution Time" value={avgResolutionDays ? `${avgResolutionDays} days` : '—'} tone="blue" />
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
