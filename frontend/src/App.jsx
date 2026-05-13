import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Navbar from "./components/layout/Navbar";

import Login            from "./pages/Login";
import Register         from "./pages/Register";
import StudentDashboard from "./pages/StudentDashboard";
import UploadResult     from "./pages/UploadResult";
import TeacherDashboard from "./pages/TeacherDashboard";
import Analytics        from "./pages/Analytics";

const RootRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "teacher" ? "/teacher" : "/student"} replace />;
};

const Layout = ({ children }) => (
  <div className="min-h-screen bg-gray-50">
    <Navbar />
    <main>{children}</main>
  </div>
);

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <Routes>
        {/* Public */}
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Root redirect */}
        <Route path="/" element={<RootRedirect />} />

        {/* Student */}
        <Route path="/student" element={
          <ProtectedRoute role="student">
            <Layout><StudentDashboard /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/student/upload" element={
          <ProtectedRoute role="student">
            <Layout><UploadResult /></Layout>
          </ProtectedRoute>
        } />

        {/* Teacher */}
        <Route path="/teacher" element={
          <ProtectedRoute role="teacher">
            <Layout><TeacherDashboard /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/teacher/analytics" element={
          <ProtectedRoute role="teacher">
            <Layout><Analytics /></Layout>
          </ProtectedRoute>
        } />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  </BrowserRouter>
);

export default App;
