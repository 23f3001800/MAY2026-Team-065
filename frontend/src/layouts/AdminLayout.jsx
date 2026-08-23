// Shell for authenticated admin pages: reuses the shared Sidebar/Topbar with
// the admin nav (no citizen CTA, no location selector).
import React, { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from '../components/dashboard/Sidebar';
import Topbar from '../components/dashboard/Topbar';
import { ADMIN_NAV } from '../components/admin/adminNav';
import { getCurrentUser, clearSession } from '../api/auth';
import AssistantWidget from '../components/ai/AssistantWidget';

export default function AdminLayout() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const user = getCurrentUser();

  const handleLogout = () => {
    clearSession();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#f2f7f4] flex">
      <Sidebar
        open={sidebarOpen}
        items={ADMIN_NAV}
        showCta={false}
        onNavigate={() => setSidebarOpen(false)}
        onLogout={handleLogout}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar user={user} notificationsHref="/admin/notifications" showLocation={false} onMenu={() => setSidebarOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 bg-gradient-to-b from-leaf-50/70 to-transparent bg-no-repeat [background-size:100%_260px]">
          <Outlet />
        </main>
      </div>
      <AssistantWidget role="admin" />
    </div>
  );
}
