import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AuthBackground from './components/AuthBackground';
import Login from './pages/Login';
import Register from './pages/Register';
import CitizenLayout from './layouts/CitizenLayout';
import CitizenDashboard from './pages/CitizenDashboard';
import ReportIssue from './pages/ReportIssue';
import MyComplaints from './pages/MyComplaints';
import ComplaintDetails from './pages/ComplaintDetails';
import Notifications from './pages/Notifications';
import NearbyIssues from './pages/NearbyIssues';
import TrackComplaints from './pages/TrackComplaints';
import AIAssistant from './pages/AIAssistant';
import Feedback from './pages/Feedback';
import AdminLayout from './layouts/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminComplaints from './pages/admin/AdminComplaints';
import AdminDepartments from './pages/admin/AdminDepartments';
import AdminCategories from './pages/admin/AdminCategories';
import AdminAnalytics from './pages/admin/AdminAnalytics';
import AdminReports from './pages/admin/AdminReports';
import AdminSettings from './pages/admin/AdminSettings';
import OfficerLayout from './layouts/OfficerLayout';
import OfficerDashboard from './pages/officer/OfficerDashboard';
import OfficerComplaints from './pages/officer/OfficerComplaints';
import OfficerWorkers from './pages/officer/OfficerWorkers';
import OfficerAnalytics from './pages/officer/OfficerAnalytics';
import WorkerLayout from './layouts/WorkerLayout';
import WorkerDashboard from './pages/worker/WorkerDashboard';
import WorkerTasks from './pages/worker/WorkerTasks';
import WorkerMap from './pages/worker/WorkerMap';
import WorkerHistory from './pages/worker/WorkerHistory';
import WorkerProfile from './pages/worker/WorkerProfile';
import Profile from './pages/shared/Profile';
import Settings from './pages/shared/Settings';
import RoleActivity from './pages/shared/RoleActivity';
import { listComplaints, listMyTasks } from './api/complaints';
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

// Sends the visitor to their role's home (or /login if signed out).
function RoleHome() {
  const user = getCurrentUser();
  return <Navigate to={user ? homePathForRole(user.role) : '/login'} replace />;
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
          <Route path="/my-complaints" element={<MyComplaints />} />
          <Route path="/complaints/:id" element={<ComplaintDetails />} />
          <Route path="/track" element={<TrackComplaints />} />
          <Route path="/nearby" element={<NearbyIssues />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/ai-assistant" element={<AIAssistant />} />
          <Route path="/feedback" element={<Feedback />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
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
          <Route path="/admin/departments" element={<AdminDepartments />} />
          <Route path="/admin/categories" element={<AdminCategories />} />
          <Route path="/admin/analytics" element={<AdminAnalytics />} />
          <Route path="/admin/reports" element={<AdminReports />} />
          <Route path="/admin/settings" element={<AdminSettings />} />
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
          <Route path="/officer/analytics" element={<OfficerAnalytics />} />
          <Route
            path="/officer/notifications"
            element={
              <RoleActivity
                fetchComplaints={listComplaints}
                viewHref="/officer/complaints"
                emptyMessage="Complaints you're tied to will show up here once there's activity."
              />
            }
          />
          <Route path="/officer/profile" element={<Profile />} />
          <Route path="/officer/settings" element={<Settings />} />
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
          <Route path="/worker/map" element={<WorkerMap />} />
          <Route path="/worker/history" element={<WorkerHistory />} />
          <Route
            path="/worker/notifications"
            element={
              <RoleActivity
                fetchComplaints={listMyTasks}
                viewHref="/worker/tasks"
                emptyMessage="Tasks assigned to you will show up here once there's activity."
              />
            }
          />
          <Route path="/worker/profile" element={<WorkerProfile />} />
          <Route path="/worker/settings" element={<Settings />} />
        </Route>

        {/* Default: route to the signed-in user's home, else /login. */}
        <Route path="*" element={<RoleHome />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
