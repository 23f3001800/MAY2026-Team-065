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
import AdminLayout from './layouts/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import OfficerLayout from './layouts/OfficerLayout';
import OfficerDashboard from './pages/officer/OfficerDashboard';
import OfficerComplaints from './pages/officer/OfficerComplaints';
import WorkerLayout from './layouts/WorkerLayout';
import WorkerDashboard from './pages/worker/WorkerDashboard';
import Placeholder from './pages/Placeholder';
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
          <Route path="/track" element={<Placeholder title="Track Complaints" />} />
          <Route path="/nearby" element={<NearbyIssues />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/ai-assistant" element={<Placeholder title="AI Assistant" />} />
          <Route path="/feedback" element={<Placeholder title="Feedback" />} />
          <Route path="/profile" element={<Placeholder title="Profile" />} />
          <Route path="/settings" element={<Placeholder title="Settings" />} />
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
          <Route path="/admin/users" element={<Placeholder title="User Management" />} />
          <Route path="/admin/complaints" element={<Placeholder title="Complaints" />} />
          <Route path="/admin/departments" element={<Placeholder title="Departments" />} />
          <Route path="/admin/categories" element={<Placeholder title="Categories" />} />
          <Route path="/admin/analytics" element={<Placeholder title="Analytics" />} />
          <Route path="/admin/reports" element={<Placeholder title="Reports" />} />
          <Route path="/admin/settings" element={<Placeholder title="Settings" />} />
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
          <Route path="/officer/workers" element={<Placeholder title="Field Workers" />} />
          <Route path="/officer/analytics" element={<Placeholder title="Analytics" />} />
          <Route path="/officer/notifications" element={<Placeholder title="Notifications" />} />
          <Route path="/officer/profile" element={<Placeholder title="Profile" />} />
          <Route path="/officer/settings" element={<Placeholder title="Settings" />} />
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
          <Route path="/worker/tasks" element={<Placeholder title="My Tasks" />} />
          <Route path="/worker/map" element={<Placeholder title="Task Map" />} />
          <Route path="/worker/history" element={<Placeholder title="History" />} />
          <Route path="/worker/notifications" element={<Placeholder title="Notifications" />} />
          <Route path="/worker/profile" element={<Placeholder title="Profile" />} />
          <Route path="/worker/settings" element={<Placeholder title="Settings" />} />
        </Route>

        {/* Default: route to the signed-in user's home, else /login. */}
        <Route path="*" element={<RoleHome />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
