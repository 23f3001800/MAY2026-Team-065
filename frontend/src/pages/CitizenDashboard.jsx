// Citizen home dashboard: KPI stats, recent complaints, and a category
// breakdown, all computed client-side from GET /complaints/ (already scoped
// server-side to the signed-in citizen — no separate stats endpoint exists).
import React, { useMemo } from 'react';
import StatCard from '../components/dashboard/StatCard';
import RecentComplaints from '../components/dashboard/RecentComplaints';
import CategoryDonut from '../components/dashboard/CategoryDonut';
import ReportBanner from '../components/dashboard/ReportBanner';
import { LoadingPanel, ErrorPanel } from '../components/dashboard/AsyncStates';
import { listComplaints } from '../api/complaints';
import useAsync from '../hooks/useAsync';

// Keep in sync with the palette used on the admin "Top Categories" chart.
const CATEGORY_COLORS = {
  Pothole: '#10b981',
  Garbage: '#3b82f6',
  'Water Leakage': '#f59e0b',
  Streetlight: '#8b5cf6',
  Other: '#94a3b8',
};

function formatTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const isToday = d.toDateString() === new Date().toDateString();
  return isToday
    ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export default function CitizenDashboard() {
  const { data, error, loading, refetch } = useAsync(() => listComplaints(), []);
  const complaints = useMemo(() => data || [], [data]);

  const stats = useMemo(() => {
    const by = (s) => complaints.filter((c) => c.status === s).length;
    return [
      { key: 'total', label: 'Total Complaints', value: complaints.length, trend: 'All time', tone: 'emerald' },
      { key: 'new', label: 'Awaiting Review', value: by('New'), trend: 'Not yet assigned', tone: 'blue' },
      { key: 'resolved', label: 'Resolved', value: by('Resolved'), trend: 'Closed out', tone: 'purple' },
      {
        key: 'critical',
        label: 'High Severity',
        value: complaints.filter((c) => c.severity === 'High' || c.severity === 'Critical').length,
        trend: 'High or Critical',
        tone: 'amber',
      },
    ];
  }, [complaints]);

  const recentComplaints = useMemo(
    () =>
      [...complaints]
        .sort((a, b) => new Date(b.reportedAt) - new Date(a.reportedAt))
        .slice(0, 5)
        .map((c) => ({ id: c.id, issue: c.issue, location: c.location, status: c.status, time: formatTime(c.reportedAt) })),
    [complaints],
  );

  const categoryBreakdown = useMemo(() => {
    if (complaints.length === 0) return [];
    const counts = new Map();
    for (const c of complaints) counts.set(c.category, (counts.get(c.category) || 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => ({
        label,
        percent: Math.round((count / complaints.length) * 100),
        color: CATEGORY_COLORS[label] || '#94a3b8',
      }));
  }, [complaints]);

  return (
    <div className="max-w-[1200px] mx-auto space-y-6">
      {/* Heading */}
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-[14px] text-slate-500">Here's what's happening with your reports.</p>
      </div>

      {loading ? (
        <LoadingPanel label="Loading your dashboard…" variant="stats" />
      ) : error ? (
        <ErrorPanel error={error} onRetry={refetch} />
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {stats.map((s) => (
              <StatCard key={s.key} {...s} />
            ))}
          </div>

          {/* Complaints + category */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              {complaints.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
                  <p className="text-[14px] text-slate-500">
                    You haven't reported anything yet. Recent complaints will appear here.
                  </p>
                </div>
              ) : (
                <RecentComplaints rows={recentComplaints} />
              )}
            </div>
            <div>
              {categoryBreakdown.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 h-full flex items-center justify-center">
                  <p className="text-[13px] text-slate-400 text-center">No category data yet</p>
                </div>
              ) : (
                <CategoryDonut data={categoryBreakdown} />
              )}
            </div>
          </div>

          {/* Report CTA */}
          <ReportBanner />
        </>
      )}
    </div>
  );
}
