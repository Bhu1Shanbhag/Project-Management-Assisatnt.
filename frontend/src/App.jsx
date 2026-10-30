import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import CreateProject from "./pages/CreateProject";
import ProjectDetails from "./pages/ProjectDetails";
import MeetingUpload from "./pages/MeetingUpload";
import GitHubIntegration from "./pages/GitHubIntegration";
import AIChat from "./pages/AIChat";
import Summary from "./pages/Summary";

/** Check if user is authenticated */
const isAuthenticated = () => !!localStorage.getItem("token");

/** Protected route wrapper */
function ProtectedRoute({ children }) {
  return isAuthenticated() ? children : <Navigate to="/login" replace />;
}

/** Layout wrapper with sidebar for authenticated pages */
function AppLayout({ children }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-64 p-8 overflow-auto">
        {children}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />

        {/* Protected */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout><Dashboard /></AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects"
          element={
            <ProtectedRoute>
              <AppLayout><Projects /></AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/new"
          element={
            <ProtectedRoute>
              <AppLayout><CreateProject /></AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/:id"
          element={
            <ProtectedRoute>
              <AppLayout><ProjectDetails /></AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/:id/meetings"
          element={
            <ProtectedRoute>
              <AppLayout><MeetingUpload /></AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/:id/github"
          element={
            <ProtectedRoute>
              <AppLayout><GitHubIntegration /></AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/:id/summary"
          element={
            <ProtectedRoute>
              <AppLayout><Summary /></AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <AppLayout><AIChat /></AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
