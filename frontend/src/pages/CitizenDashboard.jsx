// Citizen home dashboard: KPI stats, recent complaints, category breakdown,
// and a report CTA. Data is mocked for now (see src/data/mockDashboard.js).
import React from 'react';
import StatCard from '../components/dashboard/StatCard';
import RecentComplaints from '../components/dashboard/RecentComplaints';
import CategoryDonut from '../components/dashboard/CategoryDonut';
import ReportBanner from '../components/dashboard/ReportBanner';
import { stats, recentComplaints, categoryBreakdown } from '../data/mockDashboard';

export default function CitizenDashboard() {
  return (
    <div className="max-w-[1200px] mx-auto space-y-6">
      {/* Heading */}
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-[14px] text-slate-500">Here's what's happening in your city today.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((s) => (
          <StatCard key={s.key} {...s} />
        ))}
      </div>

      {/* Complaints + category */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentComplaints rows={recentComplaints} />
        </div>
        <div>
          <CategoryDonut data={categoryBreakdown} />
        </div>
      </div>

      {/* Report CTA */}
      <ReportBanner />
    </div>
  );
}
