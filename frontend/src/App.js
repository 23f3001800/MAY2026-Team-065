import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AuthBackground from './components/AuthBackground';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import CitizenLayout from './layouts/CitizenLayout';
import CitizenDashboard from './pages/CitizenDashboard';
import ReportIssue from './pages/ReportIssue';
import Complaints from './pages/Complaints';
import ComplaintDetails from './pages/ComplaintDetails';
import Notifications from './pages/Notifications';
import AIAssistant from './pages/AIAssistant';
import Feedback from './pages/Feedback';
import AdminLayout from './layouts/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminComplaints from './pages/admin/AdminComplaints';
import AdminReports from './pages/admin/AdminReports';
import OfficerLayout from './layouts/OfficerLayout';
import OfficerDashboard from './pages/officer/OfficerDashboard';
import OfficerComplaints from './pages/officer/OfficerComplaints';
import OfficerWorkers from './pages/officer/OfficerWorkers';
import WorkerLayout from './layouts/WorkerLayout';
import WorkerDashboard from './pages/worker/WorkerDashboard';
import WorkerTasks from './pages/worker/WorkerTasks';
import WorkerTaskDetail from './pages/worker/WorkerTaskDetail';
import WorkerPerformance from './pages/worker/WorkerPerformance';
import WorkerProfile from './pages/worker/WorkerProfile';
import Profile from './pages/shared/Profile';
import { getCurrentUser, homePathForRole } from './api/auth';

// Gate for an authenticated area. Sends signed-out visitors to /login, and
// signed-in users whose role does not own this area back to their own home.
function RequireAuth({ allow, children }) {
  const user = getCurrentUser();
  if (!user) return <Navigate to="/login" replace />;
  if (allow && !allow.includes(user.role)) {
    return <Navigate to={homePathForRole(user.role)} replace />;
  }
  return children;
}

// Sends the visitor to their role's home (or the public landing page if
// signed out) for any path that isn't a known route.
function RoleHome() {
  const user = getCurrentUser();
  return <Navigate to={user ? homePathForRole(user.role) : '/'} replace />;
}

// Dark, centered layout for the auth screens (login/register).
function AuthScreen({ children }) {
  return (
    <>
      <AuthBackground />
      <div className="flex items-center justify-center min-h-screen px-6 py-6 relative z-10">
        {children}
      </div>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public landing page — redirects a signed-in visitor to their dashboard */}
        <Route path="/" element={<Home />} />

        {/* Public auth screens */}
        <Route path="/login" element={<AuthScreen><Login /></AuthScreen>} />
        <Route path="/register" element={<AuthScreen><Register /></AuthScreen>} />

        {/* Authenticated citizen area (dark sidebar + light content) */}
        <Route
          element={
            <RequireAuth allow={['citizen']}>
              <CitizenLayout />
            </RequireAuth>
          }
        >
          <Route path="/dashboard" element={<CitizenDashboard />} />
          <Route path="/report" element={<ReportIssue />} />
          <Route path="/complaints" element={<Complaints />} />
          <Route path="/my-complaints" element={<Navigate to="/complaints" replace />} />
          <Route path="/complaints/:id" element={<ComplaintDetails />} />
          <Route path="/track" element={<Navigate to="/complaints" replace />} />
          <Route path="/nearby" element={<Navigate to="/complaints" replace />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/ai-assistant" element={<AIAssistant />} />
          <Route path="/feedback" element={<Feedback />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Navigate to="/profile" replace />} />
        </Route>

        {/* Authenticated admin area */}
        <Route
          element={
            <RequireAuth allow={['admin']}>
              <AdminLayout />
            </RequireAuth>
          }
        >
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/complaints" element={<AdminComplaints />} />
          <Route path="/admin/departments" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/admin/categories" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/admin/analytics" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/admin/reports" element={<AdminReports />} />
          <Route path="/admin/notifications" element={<Notifications />} />
          <Route path="/admin/profile" element={<Profile />} />
          <Route path="/admin/settings" element={<Navigate to="/admin/profile" replace />} />
        </Route>

        {/* Authenticated municipal officer area */}
        <Route
          element={
            <RequireAuth allow={['municipal_officer']}>
              <OfficerLayout />
            </RequireAuth>
          }
        >
          <Route path="/officer/dashboard" element={<OfficerDashboard />} />
          <Route path="/officer/complaints" element={<OfficerComplaints />} />
          <Route path="/officer/workers" element={<OfficerWorkers />} />
          <Route path="/officer/analytics" element={<Navigate to="/officer/dashboard" replace />} />
          <Route path="/officer/notifications" element={<Notifications />} />
          <Route path="/officer/profile" element={<Profile />} />
          <Route path="/officer/settings" element={<Navigate to="/officer/profile" replace />} />
        </Route>

        {/* Authenticated field worker area */}
        <Route
          element={
            <RequireAuth allow={['field_worker']}>
              <WorkerLayout />
            </RequireAuth>
          }
        >
          <Route path="/worker/dashboard" element={<WorkerDashboard />} />
          <Route path="/worker/tasks" element={<WorkerTasks />} />
          <Route path="/worker/tasks/:id" element={<WorkerTaskDetail />} />
          <Route path="/worker/map" element={<Navigate to="/worker/tasks" replace />} />
          <Route path="/worker/history" element={<Navigate to="/worker/tasks" replace />} />
          <Route path="/worker/notifications" element={<Notifications />} />
          <Route path="/worker/performance" element={<WorkerPerformance />} />
          <Route path="/worker/profile" element={<WorkerProfile />} />
          <Route path="/worker/settings" element={<Navigate to="/worker/profile" replace />} />
        </Route>

        {/* Default: route to the signed-in user's home, else /login. */}
        <Route path="*" element={<RoleHome />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
