// Shell for authenticated field worker pages: shared Sidebar/Topbar with the
// worker nav.
import React, { useCallback, useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from '../components/dashboard/Sidebar';
import Topbar from '../components/dashboard/Topbar';
import { WORKER_NAV } from '../components/worker/workerNav';
import { getCurrentUser, clearSession } from '../api/auth';
import AssistantWidget from '../components/ai/AssistantWidget';
import PendingUploads from '../components/worker/PendingUploads';
import { updateMyWorkerProfile } from '../api/workers';
import { flush } from '../lib/uploadQueue';

export default function WorkerLayout() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const user = getCurrentUser();

  const handleLogout = () => {
    clearSession();
    navigate('/login', { replace: true });
  };

  // The chip detects a position for the worker's own benefit; recording it is
  // what lets their task list be ordered by distance and lets dispatch see
  // where they are. Best-effort — a failed save must not break the chip.
  const recordPosition = useCallback(async (coords) => {
    try {
      await updateMyWorkerProfile({ coords });
    } catch {
      // Nothing to tell the worker here: they asked for their location, not to
      // publish it, and the profile page is where that is managed explicitly.
    }
  }, []);

  // Anything queued from a previous session goes out as soon as the worker is
  // back in the app, rather than waiting for an 'online' event that already
  // fired while the tab was closed.
  useEffect(() => { flush(); }, []);

  return (
    <div className="min-h-screen bg-[#f2f7f4] flex">
      <Sidebar
        open={sidebarOpen}
        items={WORKER_NAV}
        showCta={false}
        onNavigate={() => setSidebarOpen(false)}
        onLogout={handleLogout}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar
          user={user}
          notificationsHref="/worker/notifications"
          onMenu={() => setSidebarOpen(true)}
          onLocated={recordPosition}
        />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 bg-gradient-to-b from-leaf-50/70 to-transparent bg-no-repeat [background-size:100%_260px]">
          {/* Above the page, not inside it: evidence waiting to upload matters
              on every worker screen, not only the one it was taken on. */}
          <div className="mb-4 empty:hidden">
            <PendingUploads />
          </div>
          <Outlet />
        </main>
      </div>
      <AssistantWidget role="field_worker" />
    </div>
  );
}
