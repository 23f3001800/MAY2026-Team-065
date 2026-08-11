// Shell for authenticated field worker pages: shared Sidebar/Topbar with the
// worker nav.
import React, { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from '../components/dashboard/Sidebar';
import Topbar from '../components/dashboard/Topbar';
import { WORKER_NAV } from '../components/worker/workerNav';
import { getCurrentUser, clearSession } from '../api/auth';
import AssistantWidget from '../components/ai/AssistantWidget';

export default function WorkerLayout() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const user = getCurrentUser();

  const handleLogout = () => {
    clearSession();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-surface-sunken flex">
      <Sidebar
        open={sidebarOpen}
        items={WORKER_NAV}
        showCta={false}
        onNavigate={() => setSidebarOpen(false)}
        onLogout={handleLogout}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar user={user} notificationsHref="/worker/notifications" showLocation={false} onMenu={() => setSidebarOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 bg-gradient-to-b from-civic-50/40 to-transparent bg-no-repeat [background-size:100%_260px]">
          <Outlet />
        </main>
      </div>
      <AssistantWidget role="field_worker" />
    </div>
  );
}
